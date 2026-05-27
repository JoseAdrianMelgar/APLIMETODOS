import sympy as sp
import cmath
import math
import copy
import re
import time

# =========================================================================
# LÍMITES DE SEGURIDAD
# =========================================================================
MAX_ITER_CAP = 1000
MAX_SECONDS  = 15
MAX_FUNC_LEN = 120
RESIDUO_MAX  = 1.0
PICO_DISCONTINUIDAD = 1e3   # si |f(x)| supera esto, hubo cercania a una asintota/polo


class MetodosNumericos:

    def __init__(self):
        self.x = sp.symbols('x')

    @staticmethod
    def _normalize_funcion(s: str) -> str:
        """Normaliza notación unicode y alternativa antes de parsear."""
        UNICODE_SUP = {'⁰':'**0','¹':'**1','²':'**2','³':'**3','⁴':'**4',
                       '⁵':'**5','⁶':'**6','⁷':'**7','⁸':'**8','⁹':'**9'}
        for u, r in UNICODE_SUP.items():
            s = s.replace(u, r)
        return (s.replace('^', '**')
                 .replace('×', '*')
                 .replace('÷', '/'))

    def _parse_funcion(self, funcion_str):
        try:
            normalizada = self._normalize_funcion(funcion_str)
            normalizada = re.sub(r'\be\b', 'E', normalizada)
            return sp.sympify(normalizada)
        except Exception:
            raise ValueError(
                f"Función inválida: '{funcion_str}'. "
                "Usa ^ para potencias (x^3), * para multiplicar (2*x) "
                "y funciones como sin(x), cos(x), exp(x), ln(x), sqrt(x)."
            )
                

    @staticmethod
    def _clamp_iter(max_iter):
        try:
            m = int(max_iter)
        except (TypeError, ValueError):
            return 100
        if m < 1:   return 1
        if m > MAX_ITER_CAP: return MAX_ITER_CAP
        return m

    @staticmethod
    def _es_finito(valor):
        try:
            if isinstance(valor, complex):
                return math.isfinite(valor.real) and math.isfinite(valor.imag)
            return math.isfinite(float(valor))
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _funcion_invalida(funcion_str):
        return funcion_str is None or len(str(funcion_str)) > MAX_FUNC_LEN

    # =====================================================================
    # MÉTODO 1: NEWTON-RAPHSON
    # =====================================================================
    def newton_raphson(self, funcion_str, x0, tol=0.001, max_iter=100, derivada_str=None):
        iteraciones = []

        if self._funcion_invalida(funcion_str):
            return {
                "raiz": None, "funcion": funcion_str, "derivada": None,
                "derivada_calculada_automaticamente": False,
                "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."
            }

        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            f_expr = self._parse_funcion(funcion_str)
            derivada_auto = derivada_str is None
            df_expr = sp.diff(f_expr, self.x) if derivada_auto else self._parse_funcion(derivada_str)
            f  = sp.lambdify(self.x, f_expr,  'math')
            df = sp.lambdify(self.x, df_expr, 'math')
        except Exception as e:
            return {
                "raiz": None, "funcion": funcion_str, "derivada": None,
                "derivada_calculada_automaticamente": False,
                "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

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

                if not self._es_finito(f_xi) or not self._es_finito(df_xi):
                    return {
                        "raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Valor no finito (inf o NaN) en iteracion {iteracion}. La funcion diverge o tiene una discontinuidad."
                    }

                if abs(df_xi) < 1e-12:
                    return {
                        "raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Derivada cercana a cero en iteracion {iteracion} (f'({x_ant}) = {df_xi}). Division por cero."
                    }

                cociente = f_xi / df_xi
                x_n = x_ant - cociente

            except ZeroDivisionError:
                return {
                    "raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                    "derivada_calculada_automaticamente": derivada_auto,
                    "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None, "funcion": funcion_str, "derivada": str(df_expr),
                    "derivada_calculada_automaticamente": derivada_auto,
                    "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            err = abs((x_n - x_ant) / x_n) * 100 if x_n != 0 else abs(x_n - x_ant) * 100

            f_sust  = f_expr.subs(self.x, x_ant)
            df_sust = df_expr.subs(self.x, x_ant)
            iteraciones.append({
            "iteracion": iteracion, "xi_anterior": x_ant,
            "paso_1_evaluar_funcion": {"expresion": f"f({x_ant}) = {f_sust}", "resultado": f_xi},
            "paso_2_evaluar_derivada": {"expresion": f"f'({x_ant}) = {df_sust}", "resultado": df_xi},
            "paso_3_aplicar_formula": { ... },
            "paso_4_calcular_error": { ... },
            "xi_nuevo": x_n, "error": err,
            "f_xi":    f_xi,    # ← AGREGAR: la tabla lee esto
            "f_prima": df_xi,   # ← AGREGAR: la tabla lee esto
        })

        convergio = (not timeout) and (err <= tol)

        if convergio:
            try:
                f_final = f(x_n)
            except Exception:
                f_final = None
            if f_final is None or not self._es_finito(f_final) or abs(f_final) > RESIDUO_MAX:
                convergio = False
                mensaje = (f"El paso entre iteraciones es muy pequeno pero f(x) = {f_final} no es cercano a cero: posible discontinuidad o polo.")
            else:
                mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
        elif timeout:
            mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). Posible oscilacion o funcion muy costosa."
        else:
            mensaje = f"No se alcanzo la convergencia en {max_iter} iteraciones."

        return {
            "raiz": x_n, "funcion": funcion_str, "derivada": str(df_expr),
            "derivada_calculada_automaticamente": derivada_auto,
            "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
            "valor_inicial": float(x0), "tolerancia": tol,
            "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 2: SECANTE
    # =====================================================================
    # =====================================================================
#  IMPORTANTE: arriba de tu archivo, junto a las otras constantes
#  (donde esta RESIDUO_MAX = 1.0), agrega esta linea UNA sola vez:
#
#      PICO_DISCONTINUIDAD = 1e3
#
#  Luego selecciona TODA tu funcion "def secante(...)" actual
#  (desde la linea "def secante" hasta su "return {...}" final)
#  y reemplazala por esta version completa de abajo.
# =====================================================================

    # =====================================================================
    # MÉTODO 2: SECANTE  (con Opción A: advertencia de discontinuidad)
    # =====================================================================
    def secante(self, funcion_str, x0, x1, tol=0.001, max_iter=100):
        iteraciones = []

        if self._funcion_invalida(funcion_str):
            return {
                "raiz": None, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."
            }

        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            f_expr = self._parse_funcion(funcion_str)
            f = sp.lambdify(self.x, f_expr, 'math')
        except Exception as e:
            return {
                "raiz": None, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        x_ant = float(x0)
        x_act = float(x1)
        err = 100.0
        iteracion = 0
        timeout = False
        f_pico = 0.0   # rastrea el mayor |f(x)| visto (para detectar asintotas)

        while err > tol and iteracion < max_iter:
            if time.time() - t_inicio > MAX_SECONDS:
                timeout = True
                break
            iteracion += 1
            try:
                f_x_ant = f(x_ant)
                f_x_act = f(x_act)

                if not self._es_finito(f_x_ant) or not self._es_finito(f_x_act):
                    return {
                        "raiz": None, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Valor no finito en iteracion {iteracion}. La funcion diverge o tiene una discontinuidad."
                    }

                f_pico = max(f_pico, abs(f_x_ant), abs(f_x_act))

                denominador = f_x_act - f_x_ant
                if abs(denominador) < 1e-12:
                    return {
                        "raiz": None, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Denominador cercano a cero en iteracion {iteracion} (f(x_i) - f(x_(i-1)) = {denominador}). Division por cero."
                    }

                numerador = f_x_act * (x_act - x_ant)
                x_nuevo = x_act - (numerador / denominador)

            except ZeroDivisionError:
                return {
                    "raiz": None, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            err = abs((x_nuevo - x_act) / x_nuevo) * 100 if x_nuevo != 0 else abs(x_nuevo - x_act) * 100

            f_sust_ant = f_expr.subs(self.x, x_ant)
            f_sust_act = f_expr.subs(self.x, x_act)
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
            if f_final is None or not self._es_finito(f_final) or abs(f_final) > RESIDUO_MAX:
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
            mensaje = f"No se alcanzo la convergencia en {max_iter} iteraciones."

        return {
            "raiz": x_act, "funcion": funcion_str,
            "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
            "valor_inicial_x0": float(x0), "valor_inicial_x1": float(x1), "tolerancia": tol,
            "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "advertencia": advertencia, "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 3: MÜLLER
    # =====================================================================
    def muller(self, funcion_str, x0, x1, x2, tol=0.001, max_iter=100):
        iteraciones = []

        if self._funcion_invalida(funcion_str):
            return {
                "raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."
            }

        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            f_expr = self._parse_funcion(funcion_str)
            f = sp.lambdify(self.x, f_expr, 'math')
        except Exception as e:
            return {
                "raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

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

                if not (self._es_finito(f_p0) and self._es_finito(f_p1) and self._es_finito(f_p2)):
                    return {
                        "raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": f"Valor no finito en iteracion {iteracion}. La funcion diverge o tiene una discontinuidad."
                    }

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
                    return {
                        "raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False, "mensaje": f"Denominador cercano a cero en iteracion {iteracion}."
                    }

                p3 = p2 - (2 * c) / denominador_elegido

            except ZeroDivisionError:
                return {
                    "raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None, "raiz_es_compleja": False, "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False, "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

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
                if not self._es_finito(f_final) or abs(f_final) > RESIDUO_MAX:
                    convergio = False
            except Exception:
                convergio = False

        raiz_es_compleja_final = abs(p2.imag) > 1e-10
        raiz_final = str(p2) if raiz_es_compleja_final else p2.real

        if convergio:
            mensaje = (f"Raiz compleja encontrada en {iteracion} iteraciones: {raiz_final}."
                       if raiz_es_compleja_final
                       else f"Convergencia alcanzada en {iteracion} iteraciones.")
        elif timeout:
            mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). Posible discontinuidad o funcion muy costosa."
        else:
            mensaje = "No se alcanzo la convergencia, o el punto hallado no es una raiz real (posible discontinuidad)."

        return {
            "raiz": raiz_final, "raiz_es_compleja": raiz_es_compleja_final, "funcion": funcion_str,
            "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
            "valor_inicial_x0": float(x0), "valor_inicial_x1": float(x1), "valor_inicial_x2": float(x2),
            "tolerancia": tol, "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 4: GAUSS-SEIDEL
    # =====================================================================
    def gauss_seidel(self, A, b, x_inicial=None, tol=0.001, max_iter=100):
        iteraciones = []
        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            A_list = [list(map(float, fila)) for fila in A]
            b_list = list(map(float, b))
            n = len(A_list)

            for fila in A_list:
                if len(fila) != n:
                    return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                            "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                            "mensaje": "La matriz A no es cuadrada."}
            if len(b_list) != n:
                return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                        "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                        "mensaje": f"Longitud de b ({len(b_list)}) no coincide con n={n}."}
            for i in range(n):
                if abs(A_list[i][i]) < 1e-12:
                    return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                            "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                            "mensaje": f"Elemento diagonal A[{i}][{i}] es cero. Reordene las ecuaciones."}

            x = [0.0] * n if x_inicial is None else list(map(float, x_inicial))
            if len(x) != n:
                return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                        "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                        "mensaje": f"Longitud del vector inicial ({len(x)}) no coincide con n={n}."}
        except Exception as e:
            return {"solucion": None, "iteraciones": [], "total_iteraciones": 0,
                    "convergio": False, "mensaje": f"Error al preparar los datos: {str(e)}"}

        despejes = []
        for i in range(n):
            terminos = [f"{'- ' if A_list[i][j] >= 0 else '+ '}{abs(A_list[i][j])}*x{j+1}"
                        for j in range(n) if j != i]
            despejes.append(f"x{i+1} = ({b_list[i]} {' '.join(terminos)}) / {A_list[i][i]}")

        err_max = 100.0
        iteracion = 0
        timeout = False

        while err_max > tol and iteracion < max_iter:
            if time.time() - t_inicio > MAX_SECONDS:
                timeout = True
                break
            iteracion += 1
            x_anterior = list(x)
            pasos_variables = []
            try:
                for i in range(n):
                    xi_previo = x[i]
                    suma = sum(A_list[i][j] * x[j] for j in range(n) if j != i)
                    terminos_calculo = [{"indice_j": j+1, "coeficiente": A_list[i][j],
                                         "x_j_usado": x[j], "producto": A_list[i][j]*x[j]}
                                        for j in range(n) if j != i]
                    numerador = b_list[i] - suma
                    x[i] = numerador / A_list[i][i]
                    if not self._es_finito(x[i]):
                        return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                                "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                                "convergio": False,
                                "mensaje": f"Valor no finito en iteracion {iteracion}. El metodo diverge."}
                    error_xi = (abs((x[i] - xi_previo) / x[i]) * 100
                                if x[i] != 0 else abs(x[i] - xi_previo) * 100)
                    pasos_variables.append({
                        "variable": f"x{i+1}", "indice": i+1, "xi_previo": xi_previo,
                        "formula_despeje": despejes[i], "terminos_sumatoria": terminos_calculo,
                        "suma_no_diagonal": suma, "numerador": numerador,
                        "denominador": A_list[i][i], "resultado": x[i], "error_variable": error_xi
                    })
            except ZeroDivisionError:
                return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False, "mensaje": f"Division por cero en iteracion {iteracion}."}
            except Exception as e:
                return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                        "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                        "convergio": False, "mensaje": f"Error en iteracion {iteracion}: {str(e)}"}

            
            err_max = max(p["error_variable"] for p in pasos_variables)
            iter_entry = {
                "iteracion": iteracion, "x_anterior": x_anterior,
                "pasos_por_variable": pasos_variables, "x_nuevo": list(x),
                "error_maximo": err_max, "metodo": "gauss-seidel"
            }
            for _i in range(n):
                iter_entry[f"x{_i + 1}"] = round(x[_i], 10)
            iteraciones.append(iter_entry)
   

        convergio = (not timeout) and (err_max <= tol)
        if convergio:   mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
        elif timeout:   mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s)."
        else:           mensaje = f"No se alcanzo la convergencia en {max_iter} iteraciones."

        return {
            "solucion": x, "matriz_A": A_list, "vector_b": b_list,
            "vector_inicial": x_inicial if x_inicial is not None else [0.0] * n,
            "formula_general": "x_i^(k+1) = (b_i - sum(A_ij * x_j)) / A_ii    para j != i",
            "despejes": despejes, "tolerancia": tol,
            "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 5: GAUSS (eliminación con pivoteo parcial)
    # =====================================================================
    def gauss(self, A, b):
        """
        Eliminación Gaussiana con pivoteo parcial. Resuelve Ax = b.
        Guarda cada operación elemental de fila como un paso en 'iteraciones'.
        """
        iteraciones = []

        try:
            A_list = [list(map(float, fila)) for fila in A]
            b_list = list(map(float, b))
            n = len(A_list)

            for fila in A_list:
                if len(fila) != n:
                    return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                            "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                            "mensaje": "La matriz A no es cuadrada."}
            if len(b_list) != n:
                return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                        "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                        "mensaje": f"El vector b tiene longitud {len(b_list)}, se esperaba {n}."}
        except Exception as e:
            return {"solucion": None, "iteraciones": [], "total_iteraciones": 0,
                    "convergio": False, "mensaje": f"Error al preparar los datos: {str(e)}"}

        # Matriz aumentada [A|b]
        M = [A_list[i][:] + [b_list[i]] for i in range(n)]
        M_inicial = copy.deepcopy(M)
        paso = 0

        # ── FASE HACIA ADELANTE (triangulación superior) ──────────────────
        for col in range(n):
            # Pivoteo parcial
            max_row = col
            for row in range(col + 1, n):
                if abs(M[row][col]) > abs(M[max_row][col]):
                    max_row = row

            if abs(M[max_row][col]) < 1e-12:
                return {
                    "solucion": None, "matriz_A": A_list, "vector_b": b_list,
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Matriz singular: pivote cero en columna {col+1}. El sistema no tiene solucion unica."
                }

            if max_row != col:
                paso += 1
                M_antes = copy.deepcopy(M)
                M[col], M[max_row] = M[max_row], M[col]
                iteraciones.append({
                    "iteracion": paso, "tipo": "pivoteo",
                    "descripcion": f"Intercambio  F{col+1} ↔ F{max_row+1}  (pivote = {M[col][col]:.6g})",
                    "fila_1": col + 1, "fila_2": max_row + 1,
                    "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                    "filas_cambiadas": [col, max_row],
                    "xi_nuevo": None, "error": 0.0,
                })

            for row in range(col + 1, n):
                if abs(M[row][col]) < 1e-15:
                    continue
                factor = M[row][col] / M[col][col]
                paso += 1
                M_antes = copy.deepcopy(M)
                for j in range(col, n + 1):
                    M[row][j] -= factor * M[col][j]
                iteraciones.append({
                    "iteracion": paso, "tipo": "eliminacion",
                    "descripcion": f"F{row+1}  =  F{row+1}  −  ({factor:.6g}) × F{col+1}",
                    "fila_pivote": col + 1, "fila_objetivo": row + 1, "factor": factor,
                    "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                    "fila_cambiada": row,
                    "xi_nuevo": None, "error": 0.0,
                })

        # ── SUSTITUCIÓN REGRESIVA ──────────────────────────────────────────
        x = [0.0] * n
        for i in range(n - 1, -1, -1):
            x[i] = M[i][n]
            for j in range(i + 1, n):
                x[i] -= M[i][j] * x[j]
            x[i] /= M[i][i]
            paso += 1
            iteraciones.append({
                "iteracion": paso, "tipo": "sustitucion_regresiva",
                "descripcion": f"x{i+1}  =  {x[i]:.8g}",
                "variable_indice": i + 1, "valor": x[i],
                "solucion_parcial": x[:],
                "x_nuevo": x[:],
                "xi_nuevo": None, "error": 0.0,
            })

        return {
            "solucion": x, "matriz_A": A_list, "vector_b": b_list,
            "matriz_aumentada_inicial": M_inicial,
            "matriz_aumentada_final": copy.deepcopy(M),
            "formula_general": "Eliminacion Gaussiana con pivoteo parcial",
            "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
            "convergio": True, "tolerancia": None,
            "mensaje": f"Sistema resuelto en {len(iteraciones)} pasos (triangulacion + sustitucion regresiva)."
        }

    # =====================================================================
    # MÉTODO 6: GAUSS-JORDAN (reducción a RREF)
    # =====================================================================
    def gauss_jordan(self, A, b):
        """
        Reducción Gauss-Jordan a RREF [I|x]. Resuelve Ax = b.
        Guarda cada operación elemental: pivoteo, normalización, eliminación.
        """
        iteraciones = []

        try:
            A_list = [list(map(float, fila)) for fila in A]
            b_list = list(map(float, b))
            n = len(A_list)

            for fila in A_list:
                if len(fila) != n:
                    return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                            "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                            "mensaje": "La matriz A no es cuadrada."}
            if len(b_list) != n:
                return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                        "iteraciones": [], "total_iteraciones": 0, "convergio": False,
                        "mensaje": f"El vector b tiene longitud {len(b_list)}, se esperaba {n}."}
        except Exception as e:
            return {"solucion": None, "iteraciones": [], "total_iteraciones": 0,
                    "convergio": False, "mensaje": f"Error al preparar los datos: {str(e)}"}

        M = [A_list[i][:] + [b_list[i]] for i in range(n)]
        M_inicial = copy.deepcopy(M)
        paso = 0

        for col in range(n):
            # Pivoteo parcial
            max_row = col
            for row in range(col + 1, n):
                if abs(M[row][col]) > abs(M[max_row][col]):
                    max_row = row

            if abs(M[max_row][col]) < 1e-12:
                return {
                    "solucion": None, "matriz_A": A_list, "vector_b": b_list,
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Matriz singular: pivote cero en columna {col+1}. El sistema no tiene solucion unica."
                }

            if max_row != col:
                paso += 1
                M_antes = copy.deepcopy(M)
                M[col], M[max_row] = M[max_row], M[col]
                iteraciones.append({
                    "iteracion": paso, "tipo": "pivoteo",
                    "descripcion": f"Intercambio  F{col+1} ↔ F{max_row+1}  (pivote = {M[col][col]:.6g})",
                    "fila_1": col + 1, "fila_2": max_row + 1,
                    "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                    "filas_cambiadas": [col, max_row],
                    "xi_nuevo": None, "error": 0.0,
                })

            # Normalizar la fila pivote → M[col][col] queda = 1
            pivot = M[col][col]
            paso += 1
            M_antes = copy.deepcopy(M)
            for j in range(col, n + 1):
                M[col][j] /= pivot
            iteraciones.append({
                "iteracion": paso, "tipo": "normalizacion",
                "descripcion": f"F{col+1}  =  F{col+1}  /  ({pivot:.6g})",
                "fila": col + 1, "divisor": pivot,
                "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                "fila_cambiada": col,
                "xi_nuevo": None, "error": 0.0,
            })

            # Eliminar todas las demás filas (arriba Y abajo del pivote)
            for row in range(n):
                if row == col or abs(M[row][col]) < 1e-15:
                    continue
                factor = M[row][col]
                paso += 1
                M_antes = copy.deepcopy(M)
                for j in range(col, n + 1):
                    M[row][j] -= factor * M[col][j]
                iteraciones.append({
                    "iteracion": paso, "tipo": "eliminacion",
                    "descripcion": f"F{row+1}  =  F{row+1}  −  ({factor:.6g}) × F{col+1}",
                    "fila_pivote": col + 1, "fila_objetivo": row + 1, "factor": factor,
                    "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                    "fila_cambiada": row,
                    "xi_nuevo": None, "error": 0.0,
                })

        # Solución directa desde la columna derecha de la matriz identidad
        x = [M[i][n] for i in range(n)]
        paso += 1
        iteraciones.append({
            "iteracion": paso, "tipo": "solucion",
            "descripcion": "Lectura directa: columna derecha de [I|x]",
            "solucion_parcial": x[:], "x_nuevo": x[:],
            "xi_nuevo": None, "error": 0.0,
        })

        return {
            "solucion": x, "matriz_A": A_list, "vector_b": b_list,
            "matriz_aumentada_inicial": M_inicial,
            "matriz_aumentada_final": copy.deepcopy(M),
            "formula_general": "Eliminacion Gauss-Jordan (RREF [I|x])",
            "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
            "convergio": True, "tolerancia": None,
            "mensaje": f"Matriz reducida a RREF en {len(iteraciones)} pasos. Solucion leida directamente."
        }


# =========================================================================
# PRUEBAS RÁPIDAS
# =========================================================================
if __name__ == "__main__":
    m = MetodosNumericos()

    print("=== GAUSS 3x3 ===")
    A = [[4, 1, -1], [2, 7, 1], [1, -3, 12]]
    b = [3, 19, 31]
    r = m.gauss(A, b)
    print(f"  Solucion: {[round(v,4) for v in r['solucion']]}")
    print(f"  Pasos:    {r['total_iteraciones']}")
    print(f"  Mensaje:  {r['mensaje']}")

    print("\n=== GAUSS-JORDAN 3x3 (misma matriz) ===")
    r2 = m.gauss_jordan(A, b)
    print(f"  Solucion: {[round(v,4) for v in r2['solucion']]}")
    print(f"  Pasos:    {r2['total_iteraciones']}")
    print(f"  Mensaje:  {r2['mensaje']}")

    print("\n=== GAUSS singular ===")
    As = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    rs = m.gauss(As, [1, 2, 3])
    print(f"  Convergio: {rs['convergio']}  Mensaje: {rs['mensaje']}")

    print("\n=== Regresión raíces ===")
    print("  NR x^2-2:", round(m.newton_raphson("x**2-2", 1)['raiz'], 6))
    print("  tan(x) no converge:", m.newton_raphson("tan(x)", 1.5708, max_iter=50)['convergio'])