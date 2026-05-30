import sympy as sp
import time
from .base import (x_sym, parse_funcion, clamp_iter, es_finito,
                   funcion_invalida, MAX_FUNC_LEN, MAX_SECONDS, RESIDUO_MAX, PICO_DISCONTINUIDAD)


def secante(funcion_str, x0, x1, tol=0.001, max_iter=100):
    iteraciones = []
    if funcion_invalida(funcion_str):
        return {"raiz": None, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."}
    max_iter = clamp_iter(max_iter)
    t_inicio = time.time()
    try:
        f_expr = parse_funcion(funcion_str)
        f = sp.lambdify(x_sym, f_expr, 'math')
    except Exception as e:
        return {"raiz": None, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"}
    x_ant = float(x0)
    x_act = float(x1)
    err = 100.0
    iteracion = 0
    timeout = False
    f_pico = 0.0
    while err > tol and iteracion < max_iter:
        if time.time() - t_inicio > MAX_SECONDS:
            timeout = True
            break
        iteracion += 1
        try:
            f_x_ant = f(x_ant)
            f_x_act = f(x_act)
            if not es_finito(f_x_ant) or not es_finito(f_x_act):
                return {"raiz": None, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Valor no finito en iteracion {iteracion}. La funcion diverge o tiene una discontinuidad."}
            f_pico = max(f_pico, abs(f_x_ant), abs(f_x_act))
            denominador = f_x_act - f_x_ant
            if abs(denominador) < 1e-12:
                return {"raiz": None, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Denominador cercano a cero en iteracion {iteracion} (f(x_i) - f(x_(i-1)) = {denominador}). Division por cero."}
            numerador = f_x_act * (x_act - x_ant)
            x_nuevo = x_act - (numerador / denominador)
        except ZeroDivisionError:
            return {"raiz": None, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."}
        except Exception as e:
            return {"raiz": None, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"}
        err = abs((x_nuevo - x_act) / x_nuevo) * 100 if x_nuevo != 0 else abs(x_nuevo - x_act) * 100
        f_sust_ant = f_expr.subs(x_sym, x_ant)
        f_sust_act = f_expr.subs(x_sym, x_act)
        iteraciones.append({
            "iteracion": iteracion, "xi_anterior": x_ant, "xi_actual": x_act,
            "paso_1_evaluar_funcion_anterior": {"expresion": f"f({x_ant}) = {f_sust_ant}", "resultado": f_x_ant},
            "paso_2_evaluar_funcion_actual":   {"expresion": f"f({x_act}) = {f_sust_act}", "resultado": f_x_act},
            "paso_3_aplicar_formula": {
                "formula": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "sustitucion": f"x_{iteracion} = {x_act} - [({f_x_act})*({x_act} - {x_ant})] / [({f_x_act}) - ({f_x_ant})]",
                "numerador": numerador, "denominador": denominador, "resultado": x_nuevo
            },
            "paso_4_calcular_error": {
                "formula": "error = |(x_nuevo - x_actual) / x_nuevo| * 100%",
                "sustitucion": f"error = |({x_nuevo} - {x_act}) / {x_nuevo}| * 100%", "resultado": err
            },
            "xi_nuevo": x_nuevo, "error": err
        })
        x_ant = x_act
        x_act = x_nuevo
    convergio = (not timeout) and (err <= tol)
    advertencia = None
    if convergio:
        try:
            f_final = f(x_act)
        except Exception:
            f_final = None
        if f_final is None or not es_finito(f_final) or abs(f_final) > RESIDUO_MAX:
            convergio = False
            mensaje = f"El paso es muy pequeno pero f(x) = {f_final} no es cercano a cero: posible discontinuidad."
        else:
            mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
            if f_pico > PICO_DISCONTINUIDAD:
                advertencia = (f"Durante el calculo se detectaron valores muy grandes de f(x) "
                               f"(maximo |f| = {f_pico:.2e}), lo que sugiere cercania a una asintota "
                               f"o discontinuidad. La raiz encontrada es una raiz real valida.")
                mensaje += " [Advertencia: posible cercania a una discontinuidad.]"
    elif timeout:
        mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s)."
    else:
        mensaje = (f"No se encontro una raiz real: el metodo no convergio en {max_iter} "
                   f"iteraciones. La funcion podria no tener raices reales en esta region "
                   f"o estar divergiendo.")
    raiz_final = x_act if convergio else None
    return {"raiz": raiz_final, "ultimo_valor": x_act, "funcion": funcion_str,
            "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
            "valor_inicial_x0": float(x0), "valor_inicial_x1": float(x1), "tolerancia": tol,
            "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "advertencia": advertencia, "mensaje": mensaje}
