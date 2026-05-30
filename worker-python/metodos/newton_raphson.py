import sympy as sp
import time
from .base import (x_sym, parse_funcion, clamp_iter, es_finito,
                   funcion_invalida, MAX_FUNC_LEN, MAX_SECONDS, RESIDUO_MAX)


def newton_raphson(funcion_str, x0, tol=0.001, max_iter=100, derivada_str=None):
    iteraciones = []
    if funcion_invalida(funcion_str):
        return {"raiz": None, "funcion": funcion_str, "derivada": None,
                "derivada_calculada_automaticamente": False,
                "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."}
    max_iter = clamp_iter(max_iter)
    t_inicio = time.time()
    try:
        f_expr = parse_funcion(funcion_str)
        derivada_auto = derivada_str is None
        df_expr = sp.diff(f_expr, x_sym) if derivada_auto else parse_funcion(derivada_str)
        f  = sp.lambdify(x_sym, f_expr,  'math')
        df = sp.lambdify(x_sym, df_expr, 'math')
    except Exception as e:
        return {"raiz": None, "funcion": funcion_str, "derivada": None,
                "derivada_calculada_automaticamente": False,
                "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"}
    x_n = float(x0)
    err = 100.0
    iteracion = 0
    timeout = False
    while err > tol and iteracion < max_iter:
        if time.time() - t_inicio > MAX_SECONDS:
            timeout = True
            break
        iteracion += 1
        x_ant = x_n
        try:
            f_xi  = f(x_ant)
            df_xi = df(x_ant)
            if not es_finito(f_xi) or not es_finito(df_xi):
                return {"raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Valor no finito (inf o NaN) en iteracion {iteracion}. La funcion diverge o tiene una discontinuidad."}
            if abs(df_xi) < 1e-12:
                return {"raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Derivada cercana a cero en iteracion {iteracion} (f'({x_ant}) = {df_xi}). Division por cero."}
            cociente = f_xi / df_xi
            x_n = x_ant - cociente
        except ZeroDivisionError:
            return {"raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                    "derivada_calculada_automaticamente": derivada_auto,
                    "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."}
        except Exception as e:
            return {"raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                    "derivada_calculada_automaticamente": derivada_auto,
                    "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"}
        err = abs((x_n - x_ant) / x_n) * 100 if x_n != 0 else abs(x_n - x_ant) * 100
        f_sust  = f_expr.subs(x_sym, x_ant)
        df_sust = df_expr.subs(x_sym, x_ant)
        iteraciones.append({
            "iteracion": iteracion, "xi_anterior": x_ant,
            "paso_1_evaluar_funcion": {"expresion": f"f({x_ant}) = {f_sust}", "resultado": f_xi},
            "paso_2_evaluar_derivada": {"expresion": f"f'({x_ant}) = {df_sust}", "resultado": df_xi},
            "paso_3_aplicar_formula": {
                "formula": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "sustitucion": f"x_{iteracion} = {x_ant} - ({f_xi}) / ({df_xi})",
                "cociente": cociente, "resultado": x_n
            },
            "paso_4_calcular_error": {
                "formula": "error = |(x_nuevo - x_anterior) / x_nuevo| * 100%",
                "sustitucion": f"error = |({x_n} - {x_ant}) / {x_n}| * 100%", "resultado": err
            },
            "xi_nuevo": x_n, "error": err,
            "f_xi":    f_xi,
            "f_prima": df_xi,
        })
    convergio = (not timeout) and (err <= tol)
    if convergio:
        try:
            f_final = f(x_n)
        except Exception:
            f_final = None
        if f_final is None or not es_finito(f_final) or abs(f_final) > RESIDUO_MAX:
            convergio = False
            mensaje = (f"El paso entre iteraciones es muy pequeno pero f(x) = {f_final} no es cercano a cero: posible discontinuidad o polo.")
        else:
            mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
    elif timeout:
        mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). Posible oscilacion o funcion muy costosa."
    else:
        mensaje = (f"No se encontro una raiz real: el metodo no convergio en {max_iter} "
                   f"iteraciones. La funcion podria no tener raices reales en esta region "
                   f"o estar divergiendo (ej. x^2+9 solo tiene raices complejas +-3i).")
    raiz_final = x_n if convergio else None
    return {"raiz": raiz_final, "ultimo_valor": x_n,
            "funcion": funcion_str, "derivada": str(df_expr),
            "derivada_calculada_automaticamente": derivada_auto,
            "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
            "valor_inicial": float(x0), "tolerancia": tol,
            "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "mensaje": mensaje}
