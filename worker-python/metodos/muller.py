import sympy as sp
import cmath
import time
from .base import (x_sym, parse_funcion, clamp_iter, es_finito,
                   funcion_invalida, MAX_FUNC_LEN, MAX_SECONDS, RESIDUO_MAX)


def muller(funcion_str, x0, x1, x2, tol=0.001, max_iter=100):
    iteraciones = []
    if funcion_invalida(funcion_str):
        return {"raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."}
    max_iter = clamp_iter(max_iter)
    t_inicio = time.time()
    try:
        f_expr = parse_funcion(funcion_str)
        f = sp.lambdify(x_sym, f_expr, 'math')
    except Exception as e:
        return {"raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"}
    p0, p1, p2 = complex(x0), complex(x1), complex(x2)
    err = 100.0
    iteracion = 0
    timeout = False
    while err > tol and iteracion < max_iter:
        if time.time() - t_inicio > MAX_SECONDS:
            timeout = True
            break
        iteracion += 1
        try:
            f_p0 = complex(f(p0.real) if p0.imag == 0 else f(p0))
            f_p1 = complex(f(p1.real) if p1.imag == 0 else f(p1))
            f_p2 = complex(f(p2.real) if p2.imag == 0 else f(p2))
            if not (es_finito(f_p0) and es_finito(f_p1) and es_finito(f_p2)):
                return {"raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Valor no finito en iteracion {iteracion}. La funcion diverge o tiene una discontinuidad."}
            h0, h1 = p1 - p0, p2 - p1
            delta0 = (f_p1 - f_p0) / h0
            delta1 = (f_p2 - f_p1) / h1
            a = (delta1 - delta0) / (h1 + h0)
            b = a * h1 + delta1
            c = f_p2
            discriminante = b ** 2 - 4 * a * c
            raiz_disc = cmath.sqrt(discriminante)
            denom_mas   = b + raiz_disc
            denom_menos = b - raiz_disc
            if abs(denom_mas) >= abs(denom_menos):
                denominador_elegido, signo_elegido = denom_mas, "+"
            else:
                denominador_elegido, signo_elegido = denom_menos, "-"
            if abs(denominador_elegido) < 1e-12:
                return {"raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False, "mensaje": f"Denominador cercano a cero en iteracion {iteracion}."}
            p3 = p2 - (2 * c) / denominador_elegido
        except ZeroDivisionError:
            return {"raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."}
        except Exception as e:
            return {"raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"}
        err = (abs((p3 - p2) / p3) * 100) if abs(p3) > 1e-12 else abs(p3 - p2) * 100
        raiz_es_compleja = abs(p3.imag) > 1e-10
        def fmt(v):
            return str(v.real) if abs(v.imag) < 1e-10 else str(v)
        iteraciones.append({
            "iteracion": iteracion,
            "x0_actual": fmt(p0), "x1_actual": fmt(p1), "x2_actual": fmt(p2),
            "paso_1_diferencias_h": {
                "formula": "h0 = x1 - x0    |    h1 = x2 - x1",
                "h0": fmt(h0), "h1": fmt(h1),
                "sustitucion_h0": f"h0 = {fmt(p1)} - {fmt(p0)} = {fmt(h0)}",
                "sustitucion_h1": f"h1 = {fmt(p2)} - {fmt(p1)} = {fmt(h1)}"
            },
            "paso_2_diferencias_divididas": {
                "formula": "delta0 = (f(x1)-f(x0))/h0    |    delta1 = (f(x2)-f(x1))/h1",
                "f_x0": fmt(f_p0), "f_x1": fmt(f_p1), "f_x2": fmt(f_p2),
                "delta0": fmt(delta0), "delta1": fmt(delta1),
                "sustitucion_d0": f"delta0 = ({fmt(f_p1)} - {fmt(f_p0)}) / {fmt(h0)} = {fmt(delta0)}",
                "sustitucion_d1": f"delta1 = ({fmt(f_p2)} - {fmt(f_p1)}) / {fmt(h1)} = {fmt(delta1)}"
            },
            "paso_3_coeficientes_parabola": {
                "formula": "a = (delta1-delta0)/(h1+h0)   b = a*h1+delta1   c = f(x2)",
                "a": fmt(a), "b": fmt(b), "c": fmt(c),
                "sustitucion_a": f"a = ({fmt(delta1)} - {fmt(delta0)}) / ({fmt(h1)} + {fmt(h0)}) = {fmt(a)}",
                "sustitucion_b": f"b = ({fmt(a)})*({fmt(h1)}) + {fmt(delta1)} = {fmt(b)}",
                "sustitucion_c": f"c = f({fmt(p2)}) = {fmt(c)}"
            },
            "paso_4_discriminante": {
                "formula": "discriminante = b^2 - 4*a*c",
                "discriminante": fmt(discriminante), "raiz_discriminante": fmt(raiz_disc),
                "sustitucion": f"discriminante = ({fmt(b)})^2 - 4*({fmt(a)})*({fmt(c)}) = {fmt(discriminante)}",
                "es_complejo": discriminante.real < 0 and abs(discriminante.imag) < 1e-10
            },
            "paso_5_elegir_denominador": {
                "formula": "elegir |b + sqrt(disc)| vs |b - sqrt(disc)|",
                "denom_mas": fmt(denom_mas), "denom_menos": fmt(denom_menos),
                "abs_denom_mas": abs(denom_mas), "abs_denom_menos": abs(denom_menos),
                "signo_elegido": signo_elegido, "denominador_elegido": fmt(denominador_elegido)
            },
            "paso_6_nuevo_punto": {
                "formula": "x3 = x2 - (2*c) / denominador_elegido",
                "sustitucion": f"x3 = {fmt(p2)} - (2 * {fmt(c)}) / {fmt(denominador_elegido)}",
                "resultado": fmt(p3)
            },
            "paso_7_calcular_error": {
                "formula": "error = |(x3 - x2) / x3| * 100%",
                "sustitucion": f"error = |({fmt(p3)} - {fmt(p2)}) / {fmt(p3)}| * 100%",
                "resultado": err.real if hasattr(err, 'real') else err
            },
            "xi_nuevo": fmt(p3),
            "error": err.real if hasattr(err, 'real') else err,
            "raiz_es_compleja": raiz_es_compleja
        })
        p0, p1, p2 = p1, p2, p3
    err_final = err.real if hasattr(err, 'real') else err
    convergio = (not timeout) and (err_final <= tol)
    if convergio:
        try:
            f_final = f(p2.real) if abs(p2.imag) < 1e-12 else f(p2)
            if not es_finito(f_final) or abs(f_final) > RESIDUO_MAX:
                convergio = False
        except Exception:
            convergio = False
    raiz_es_compleja_final = abs(p2.imag) > 1e-10
    valor_p2   = str(p2) if raiz_es_compleja_final else p2.real
    raiz_final = valor_p2 if convergio else None
    if convergio:
        mensaje = (f"Raiz compleja encontrada en {iteracion} iteraciones: {raiz_final}."
                   if raiz_es_compleja_final
                   else f"Convergencia alcanzada en {iteracion} iteraciones.")
    elif timeout:
        mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). Posible discontinuidad o funcion muy costosa."
    else:
        mensaje = "No se alcanzo la convergencia, o el punto hallado no es una raiz real (posible discontinuidad)."
    return {"raiz": raiz_final, "ultimo_valor": valor_p2,
            "raiz_es_compleja": raiz_es_compleja_final, "funcion": funcion_str,
            "formula_general": "x_{i+1} = x_2 - (2*c) / (b +- sqrt(b^2 - 4*a*c))",
            "valor_inicial_x0": float(x0), "valor_inicial_x1": float(x1), "valor_inicial_x2": float(x2),
            "tolerancia": tol, "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "mensaje": mensaje}
