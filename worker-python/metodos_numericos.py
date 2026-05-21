import sympy as sp
import cmath
import math
import re
import time

# =========================================================================
# LÍMITES DE SEGURIDAD (anti-cuelgue / anti-colapso del sistema)
# =========================================================================
MAX_ITER_CAP = 1000      # Tope duro de iteraciones aunque el usuario pida más (bug 4)
MAX_SECONDS  = 15        # Tiempo máximo de cálculo por job - reloj de pared (bug 7/8)
MAX_FUNC_LEN = 120       # Largo máximo permitido de la función f(x) (bug 4/spam)
RESIDUO_MAX  = 1.0       # |f(x)| máximo para aceptar una raíz como válida (anti-polo, bug 3)


class MetodosNumericos:
    """
    Clase que agrupa los métodos numéricos del proyecto.

    Cada función retorna un diccionario con:
      - El resultado final (raíz, vector solución, etc.)
      - El paso a paso detallado de cada operación
      - La lista de iteraciones (cuando aplica)
      - El estado de convergencia y mensaje
    """

    def __init__(self):
        # Símbolo simbólico reutilizable para sympy
        self.x = sp.symbols('x')

    def _parse_funcion(self, funcion_str):
        """
        Parsea la función con SymPy mapeando 'e' a la constante de Euler.
        Convierte e^x / e**x para que se interprete como Euler y no como símbolo.
        """
        funcion_procesada = re.sub(r'\be\b', 'E', funcion_str)
        return sp.sympify(funcion_procesada)

    # ---------------------------------------------------------------------
    # HELPERS DE SEGURIDAD
    # ---------------------------------------------------------------------
    @staticmethod
    def _clamp_iter(max_iter):
        """Asegura que max_iter sea un entero válido dentro de los límites."""
        try:
            m = int(max_iter)
        except (TypeError, ValueError):
            return 100
        if m < 1:
            return 1
        if m > MAX_ITER_CAP:
            return MAX_ITER_CAP
        return m

    @staticmethod
    def _es_finito(valor):
        """True si el valor (real o complejo) es finito (no inf/NaN)."""
        try:
            if isinstance(valor, complex):
                return math.isfinite(valor.real) and math.isfinite(valor.imag)
            return math.isfinite(float(valor))
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _funcion_invalida(funcion_str):
        """True si la función es None o excede el largo máximo permitido."""
        return funcion_str is None or len(str(funcion_str)) > MAX_FUNC_LEN

    # =====================================================================
    # MÉTODO 1: NEWTON-RAPHSON (con paso a paso completo)
    # =====================================================================
    def newton_raphson(self, funcion_str, x0, tol=0.001, max_iter=100, derivada_str=None):
        iteraciones = []

        # ----- VALIDACIÓN DE LÍMITES (anti-spam / anti-función absurda) -----
        if self._funcion_invalida(funcion_str):
            return {
                "raiz": None,
                "funcion": funcion_str,
                "derivada": None,
                "derivada_calculada_automaticamente": False,
                "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."
            }

        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            # ----- PREPARACIÓN: parsear función y derivada -----
            f_expr = self._parse_funcion(funcion_str)

            derivada_auto = derivada_str is None
            if derivada_auto:
                df_expr = sp.diff(f_expr, self.x)
            else:
                df_expr = self._parse_funcion(derivada_str)

            f = sp.lambdify(self.x, f_expr, 'math')
            df = sp.lambdify(self.x, df_expr, 'math')

        except Exception as e:
            return {
                "raiz": None,
                "funcion": funcion_str,
                "derivada": None,
                "derivada_calculada_automaticamente": False,
                "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        x_n = float(x0)
        err = 100.0
        iteracion = 0
        timeout = False

        # ----- CICLO PRINCIPAL CON PASO A PASO -----
        while err > tol and iteracion < max_iter:
            # Corte por tiempo (bug 7/8: oscilación o función muy costosa)
            if time.time() - t_inicio > MAX_SECONDS:
                timeout = True
                break

            iteracion += 1
            x_ant = x_n

            try:
                f_xi = f(x_ant)
                df_xi = df(x_ant)

                # Guarda contra inf / NaN (bug 8/9: divergencia o discontinuidad)
                if not self._es_finito(f_xi) or not self._es_finito(df_xi):
                    return {
                        "raiz": None,
                        "funcion": funcion_str,
                        "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones,
                        "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": (
                            f"Valor no finito (inf o NaN) en iteracion {iteracion}. "
                            f"La funcion diverge o tiene una discontinuidad."
                        )
                    }

                # Validar division por cero
                if abs(df_xi) < 1e-12:
                    return {
                        "raiz": None,
                        "funcion": funcion_str,
                        "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones,
                        "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": (
                            f"Derivada cercana a cero en iteracion {iteracion} "
                            f"(f'({x_ant}) = {df_xi}). Division por cero."
                        )
                    }

                cociente = f_xi / df_xi
                x_n = x_ant - cociente

            except ZeroDivisionError:
                return {
                    "raiz": None,
                    "funcion": funcion_str,
                    "derivada": str(df_expr),
                    "derivada_calculada_automaticamente": derivada_auto,
                    "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None,
                    "funcion": funcion_str,
                    "derivada": str(df_expr),
                    "derivada_calculada_automaticamente": derivada_auto,
                    "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            # Paso 4: Calcular error relativo porcentual
            if x_n != 0:
                err = abs((x_n - x_ant) / x_n) * 100
            else:
                err = abs(x_n - x_ant) * 100

            f_sustituido = f_expr.subs(self.x, x_ant)
            df_sustituido = df_expr.subs(self.x, x_ant)

            iteraciones.append({
                "iteracion": iteracion,
                "xi_anterior": x_ant,
                "paso_1_evaluar_funcion": {
                    "expresion": f"f({x_ant}) = {f_sustituido}",
                    "resultado": f_xi
                },
                "paso_2_evaluar_derivada": {
                    "expresion": f"f'({x_ant}) = {df_sustituido}",
                    "resultado": df_xi
                },
                "paso_3_aplicar_formula": {
                    "formula": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                    "sustitucion": f"x_{iteracion} = {x_ant} - ({f_xi} / {df_xi})",
                    "cociente": cociente,
                    "resultado": x_n
                },
                "paso_4_calcular_error": {
                    "formula": "error = |(x_nuevo - x_anterior) / x_nuevo| * 100%",
                    "sustitucion": f"error = |({x_n} - {x_ant}) / {x_n}| * 100%",
                    "resultado": err
                },
                "xi_nuevo": x_n,
                "error": err
            })

        # ----- RESULTADO FINAL CON CHEQUEO DE RESIDUO (anti-falsa convergencia) -----
        convergio = (not timeout) and (err <= tol)

        if convergio:
            # Verificar que x_n sea realmente una raíz: f(x_n) debe ser ~0 y finito.
            try:
                f_final = f(x_n)
            except Exception:
                f_final = None

            if (f_final is None) or (not self._es_finito(f_final)) or (abs(f_final) > RESIDUO_MAX):
                convergio = False
                mensaje = (
                    f"El paso entre iteraciones es muy pequeno pero f(x) = {f_final} "
                    f"no es cercano a cero: posible discontinuidad o polo (no es una raiz real)."
                )
            else:
                mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
        elif timeout:
            mensaje = (
                f"Tiempo de calculo excedido ({MAX_SECONDS}s). "
                f"Posible oscilacion (ej. x^(1/3)) o funcion muy costosa."
            )
        else:
            mensaje = f"No se alcanzo la convergencia en {max_iter} iteraciones."

        return {
            "raiz": x_n,
            "funcion": funcion_str,
            "derivada": str(df_expr),
            "derivada_calculada_automaticamente": derivada_auto,
            "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
            "valor_inicial": float(x0),
            "tolerancia": tol,
            "iteraciones": iteraciones,
            "total_iteraciones": iteracion,
            "convergio": convergio,
            "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 2: SECANTE (con paso a paso completo)
    # =====================================================================
    def secante(self, funcion_str, x0, x1, tol=0.001, max_iter=100):
        iteraciones = []

        if self._funcion_invalida(funcion_str):
            return {
                "raiz": None,
                "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."
            }

        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            # Usar _parse_funcion para soportar e^x igual que Newton/Müller
            f_expr = self._parse_funcion(funcion_str)
            f = sp.lambdify(self.x, f_expr, 'math')

        except Exception as e:
            return {
                "raiz": None,
                "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        x_ant = float(x0)
        x_act = float(x1)
        err = 100.0
        iteracion = 0
        timeout = False

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
                        "raiz": None,
                        "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones,
                        "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": (
                            f"Valor no finito (inf o NaN) en iteracion {iteracion}. "
                            f"La funcion diverge o tiene una discontinuidad."
                        )
                    }

                denominador = f_x_act - f_x_ant
                if abs(denominador) < 1e-12:
                    return {
                        "raiz": None,
                        "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones,
                        "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": (
                            f"Denominador cercano a cero en iteracion {iteracion} "
                            f"(f(x_i) - f(x_(i-1)) = {denominador}). Division por cero."
                        )
                    }

                numerador = f_x_act * (x_act - x_ant)
                x_nuevo = x_act - (numerador / denominador)

            except ZeroDivisionError:
                return {
                    "raiz": None,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            if x_nuevo != 0:
                err = abs((x_nuevo - x_act) / x_nuevo) * 100
            else:
                err = abs(x_nuevo - x_act) * 100

            f_sustituido_ant = f_expr.subs(self.x, x_ant)
            f_sustituido_act = f_expr.subs(self.x, x_act)

            iteraciones.append({
                "iteracion": iteracion,
                "xi_anterior": x_ant,
                "xi_actual": x_act,
                "paso_1_evaluar_funcion_anterior": {
                    "expresion": f"f({x_ant}) = {f_sustituido_ant}",
                    "resultado": f_x_ant
                },
                "paso_2_evaluar_funcion_actual": {
                    "expresion": f"f({x_act}) = {f_sustituido_act}",
                    "resultado": f_x_act
                },
                "paso_3_aplicar_formula": {
                    "formula": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "sustitucion": (
                        f"x_{iteracion} = {x_act} - "
                        f"[({f_x_act})*({x_act} - {x_ant})] / "
                        f"[({f_x_act}) - ({f_x_ant})]"
                    ),
                    "numerador": numerador,
                    "denominador": denominador,
                    "resultado": x_nuevo
                },
                "paso_4_calcular_error": {
                    "formula": "error = |(x_nuevo - x_actual) / x_nuevo| * 100%",
                    "sustitucion": f"error = |({x_nuevo} - {x_act}) / {x_nuevo}| * 100%",
                    "resultado": err
                },
                "xi_nuevo": x_nuevo,
                "error": err
            })

            x_ant = x_act
            x_act = x_nuevo

        # ----- RESULTADO FINAL CON CHEQUEO DE RESIDUO -----
        convergio = (not timeout) and (err <= tol)

        if convergio:
            try:
                f_final = f(x_act)
            except Exception:
                f_final = None
            if (f_final is None) or (not self._es_finito(f_final)) or (abs(f_final) > RESIDUO_MAX):
                convergio = False
                mensaje = (
                    f"El paso entre iteraciones es muy pequeno pero f(x) = {f_final} "
                    f"no es cercano a cero: posible discontinuidad o polo (no es una raiz real)."
                )
            else:
                mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
        elif timeout:
            mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). Posible oscilacion o funcion muy costosa."
        else:
            mensaje = f"No se alcanzo la convergencia en {max_iter} iteraciones."

        return {
            "raiz": x_act,
            "funcion": funcion_str,
            "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
            "valor_inicial_x0": float(x0),
            "valor_inicial_x1": float(x1),
            "tolerancia": tol,
            "iteraciones": iteraciones,
            "total_iteraciones": iteracion,
            "convergio": convergio,
            "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 3: MÜLLER (con paso a paso completo)
    # =====================================================================
    def muller(self, funcion_str, x0, x1, x2, tol=0.001, max_iter=100):
        iteraciones = []

        if self._funcion_invalida(funcion_str):
            return {
                "raiz": None,
                "raiz_es_compleja": False,
                "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"La funcion es invalida o demasiado larga (maximo {MAX_FUNC_LEN} caracteres)."
            }

        max_iter = self._clamp_iter(max_iter)
        t_inicio = time.time()

        try:
            f_expr = self._parse_funcion(funcion_str)
            f = sp.lambdify(self.x, f_expr, 'math')

        except Exception as e:
            return {
                "raiz": None,
                "raiz_es_compleja": False,
                "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        p0 = complex(x0)
        p1 = complex(x1)
        p2 = complex(x2)

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
                        "raiz": None,
                        "raiz_es_compleja": False,
                        "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones,
                        "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": (
                            f"Valor no finito (inf o NaN) en iteracion {iteracion}. "
                            f"La funcion diverge o tiene una discontinuidad."
                        )
                    }

                h0 = p1 - p0
                h1 = p2 - p1

                delta0 = (f_p1 - f_p0) / h0
                delta1 = (f_p2 - f_p1) / h1

                a = (delta1 - delta0) / (h1 + h0)
                b = a * h1 + delta1
                c = f_p2

                discriminante = b ** 2 - 4 * a * c
                raiz_disc = cmath.sqrt(discriminante)

                denom_mas = b + raiz_disc
                denom_menos = b - raiz_disc

                if abs(denom_mas) >= abs(denom_menos):
                    denominador_elegido = denom_mas
                    signo_elegido = "+"
                else:
                    denominador_elegido = denom_menos
                    signo_elegido = "-"

                if abs(denominador_elegido) < 1e-12:
                    return {
                        "raiz": None,
                        "raiz_es_compleja": False,
                        "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones,
                        "total_iteraciones": len(iteraciones),
                        "convergio": False,
                        "mensaje": (
                            f"Denominador cercano a cero en iteracion {iteracion}. "
                            f"No se puede continuar."
                        )
                    }

                p3 = p2 - (2 * c) / denominador_elegido

            except ZeroDivisionError:
                return {
                    "raiz": None,
                    "raiz_es_compleja": False,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None,
                    "raiz_es_compleja": False,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            if abs(p3) > 1e-12:
                err = abs((p3 - p2) / p3) * 100
            else:
                err = abs(p3 - p2) * 100

            raiz_es_compleja = abs(p3.imag) > 1e-10

            def fmt(v):
                if abs(v.imag) < 1e-10:
                    return str(v.real)
                return str(v)

            iteraciones.append({
                "iteracion": iteracion,
                "x0_actual": fmt(p0),
                "x1_actual": fmt(p1),
                "x2_actual": fmt(p2),
                "paso_1_diferencias_h": {
                    "formula": "h0 = x1 - x0    |    h1 = x2 - x1",
                    "h0": fmt(h0),
                    "h1": fmt(h1),
                    "sustitucion_h0": f"h0 = {fmt(p1)} - {fmt(p0)} = {fmt(h0)}",
                    "sustitucion_h1": f"h1 = {fmt(p2)} - {fmt(p1)} = {fmt(h1)}"
                },
                "paso_2_diferencias_divididas": {
                    "formula": "delta0 = (f(x1)-f(x0))/h0    |    delta1 = (f(x2)-f(x1))/h1",
                    "f_x0": fmt(f_p0),
                    "f_x1": fmt(f_p1),
                    "f_x2": fmt(f_p2),
                    "delta0": fmt(delta0),
                    "delta1": fmt(delta1),
                    "sustitucion_d0": f"delta0 = ({fmt(f_p1)} - {fmt(f_p0)}) / {fmt(h0)} = {fmt(delta0)}",
                    "sustitucion_d1": f"delta1 = ({fmt(f_p2)} - {fmt(f_p1)}) / {fmt(h1)} = {fmt(delta1)}"
                },
                "paso_3_coeficientes_parabola": {
                    "formula": "a = (delta1 - delta0)/(h1+h0)    |    b = a*h1 + delta1    |    c = f(x2)",
                    "a": fmt(a),
                    "b": fmt(b),
                    "c": fmt(c),
                    "sustitucion_a": f"a = ({fmt(delta1)} - {fmt(delta0)}) / ({fmt(h1)} + {fmt(h0)}) = {fmt(a)}",
                    "sustitucion_b": f"b = ({fmt(a)})*({fmt(h1)}) + {fmt(delta1)} = {fmt(b)}",
                    "sustitucion_c": f"c = f({fmt(p2)}) = {fmt(c)}"
                },
                "paso_4_discriminante": {
                    "formula": "discriminante = b^2 - 4*a*c",
                    "discriminante": fmt(discriminante),
                    "raiz_discriminante": fmt(raiz_disc),
                    "sustitucion": f"discriminante = ({fmt(b)})^2 - 4*({fmt(a)})*({fmt(c)}) = {fmt(discriminante)}",
                    "es_complejo": discriminante.real < 0 and abs(discriminante.imag) < 1e-10
                },
                "paso_5_elegir_denominador": {
                    "formula": "elegir |b + sqrt(disc)| vs |b - sqrt(disc)|",
                    "denom_mas": fmt(denom_mas),
                    "denom_menos": fmt(denom_menos),
                    "abs_denom_mas": abs(denom_mas),
                    "abs_denom_menos": abs(denom_menos),
                    "signo_elegido": signo_elegido,
                    "denominador_elegido": fmt(denominador_elegido)
                },
                "paso_6_nuevo_punto": {
                    "formula": "x3 = x2 - (2*c) / denominador_elegido",
                    "sustitucion": (
                        f"x3 = {fmt(p2)} - (2 * {fmt(c)}) / {fmt(denominador_elegido)}"
                    ),
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

            p0 = p1
            p1 = p2
            p2 = p3

        # ----- RESULTADO FINAL -----
        err_final = err.real if hasattr(err, 'real') else err
        convergio = (not timeout) and (err_final <= tol)

        # Chequeo de residuo (anti-falsa convergencia / polo, ej. tan(x))
        if convergio:
            try:
                f_final = f(p2.real) if abs(p2.imag) < 1e-12 else f(p2)
                if (not self._es_finito(f_final)) or (abs(f_final) > RESIDUO_MAX):
                    convergio = False
            except Exception:
                convergio = False

        raiz_es_compleja_final = abs(p2.imag) > 1e-10

        if raiz_es_compleja_final:
            raiz_final = str(p2)
        else:
            raiz_final = p2.real

        if convergio:
            if raiz_es_compleja_final:
                mensaje = f"Raiz compleja encontrada en {iteracion} iteraciones: {raiz_final}."
            else:
                mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
        elif timeout:
            mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). Posible discontinuidad o funcion muy costosa."
        else:
            mensaje = (
                f"No se alcanzo la convergencia en {max_iter} iteraciones, o el punto "
                f"hallado no es una raiz real (posible discontinuidad)."
            )

        return {
            "raiz": raiz_final,
            "raiz_es_compleja": raiz_es_compleja_final,
            "funcion": funcion_str,
            "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
            "valor_inicial_x0": float(x0),
            "valor_inicial_x1": float(x1),
            "valor_inicial_x2": float(x2),
            "tolerancia": tol,
            "iteraciones": iteraciones,
            "total_iteraciones": iteracion,
            "convergio": convergio,
            "mensaje": mensaje
        }

    # =====================================================================
    # MÉTODO 4: GAUSS-SEIDEL (con paso a paso completo)
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
                    return {
                        "solucion": None,
                        "matriz_A": A_list,
                        "vector_b": b_list,
                        "iteraciones": [],
                        "total_iteraciones": 0,
                        "convergio": False,
                        "mensaje": "Error: la matriz A no es cuadrada."
                    }

            if len(b_list) != n:
                return {
                    "solucion": None,
                    "matriz_A": A_list,
                    "vector_b": b_list,
                    "iteraciones": [],
                    "total_iteraciones": 0,
                    "convergio": False,
                    "mensaje": (
                        f"Error: la longitud del vector b ({len(b_list)}) "
                        f"no coincide con el tamaño de la matriz A ({n})."
                    )
                }

            for i in range(n):
                if abs(A_list[i][i]) < 1e-12:
                    return {
                        "solucion": None,
                        "matriz_A": A_list,
                        "vector_b": b_list,
                        "iteraciones": [],
                        "total_iteraciones": 0,
                        "convergio": False,
                        "mensaje": (
                            f"Error: el elemento diagonal A[{i}][{i}] es cero. "
                            f"Reordene las ecuaciones para evitar division por cero."
                        )
                    }

            if x_inicial is None:
                x = [0.0] * n
            else:
                if len(x_inicial) != n:
                    return {
                        "solucion": None,
                        "matriz_A": A_list,
                        "vector_b": b_list,
                        "iteraciones": [],
                        "total_iteraciones": 0,
                        "convergio": False,
                        "mensaje": (
                            f"Error: la longitud del vector inicial ({len(x_inicial)}) "
                            f"no coincide con n = {n}."
                        )
                    }
                x = list(map(float, x_inicial))

        except Exception as e:
            return {
                "solucion": None,
                "iteraciones": [],
                "total_iteraciones": 0,
                "convergio": False,
                "mensaje": f"Error al preparar los datos: {str(e)}"
            }

        despejes = []
        for i in range(n):
            terminos = []
            for j in range(n):
                if j != i:
                    coef = A_list[i][j]
                    if coef >= 0:
                        terminos.append(f"- {coef}*x{j + 1}")
                    else:
                        terminos.append(f"+ {abs(coef)}*x{j + 1}")
            despeje_str = (
                f"x{i + 1} = ({b_list[i]} "
                f"{' '.join(terminos)}) / {A_list[i][i]}"
            )
            despejes.append(despeje_str)

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

                    suma = 0.0
                    terminos_calculo = []
                    for j in range(n):
                        if j != i:
                            producto = A_list[i][j] * x[j]
                            suma += producto
                            terminos_calculo.append({
                                "indice_j": j + 1,
                                "coeficiente": A_list[i][j],
                                "x_j_usado": x[j],
                                "producto": producto
                            })

                    numerador = b_list[i] - suma
                    x[i] = numerador / A_list[i][i]

                    # Guarda contra divergencia (diagonal no dominante)
                    if not self._es_finito(x[i]):
                        return {
                            "solucion": None,
                            "matriz_A": A_list,
                            "vector_b": b_list,
                            "iteraciones": iteraciones,
                            "total_iteraciones": len(iteraciones),
                            "convergio": False,
                            "mensaje": (
                                f"Valor no finito en iteracion {iteracion}. El metodo diverge "
                                f"(la matriz no es diagonalmente dominante)."
                            )
                        }

                    if x[i] != 0:
                        error_xi = abs((x[i] - xi_previo) / x[i]) * 100
                    else:
                        error_xi = abs(x[i] - xi_previo) * 100

                    partes = [f"{b_list[i]}"]
                    for t in terminos_calculo:
                        if t["coeficiente"] >= 0:
                            partes.append(f"- ({t['coeficiente']})*({t['x_j_usado']})")
                        else:
                            partes.append(f"+ ({abs(t['coeficiente'])})*({t['x_j_usado']})")
                    sustitucion_str = (
                        f"x{i + 1} = ({' '.join(partes)}) / {A_list[i][i]}"
                    )

                    pasos_variables.append({
                        "variable": f"x{i + 1}",
                        "indice": i + 1,
                        "xi_previo": xi_previo,
                        "formula_despeje": despejes[i],
                        "terminos_sumatoria": terminos_calculo,
                        "suma_no_diagonal": suma,
                        "numerador": numerador,
                        "denominador": A_list[i][i],
                        "sustitucion": sustitucion_str,
                        "resultado": x[i],
                        "error_variable": error_xi
                    })

            except ZeroDivisionError:
                return {
                    "solucion": None,
                    "matriz_A": A_list,
                    "vector_b": b_list,
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "solucion": None,
                    "matriz_A": A_list,
                    "vector_b": b_list,
                    "iteraciones": iteraciones,
                    "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            err_max = max(p["error_variable"] for p in pasos_variables)

            iteraciones.append({
                "iteracion": iteracion,
                "x_anterior": x_anterior,
                "pasos_por_variable": pasos_variables,
                "x_nuevo": list(x),
                "error_maximo": err_max
            })

        convergio = (not timeout) and (err_max <= tol)
        if convergio:
            mensaje = f"Convergencia alcanzada en {iteracion} iteraciones."
        elif timeout:
            mensaje = f"Tiempo de calculo excedido ({MAX_SECONDS}s). El metodo puede no converger."
        else:
            mensaje = f"No se alcanzo la convergencia en {max_iter} iteraciones."

        return {
            "solucion": x,
            "matriz_A": A_list,
            "vector_b": b_list,
            "vector_inicial": x_inicial if x_inicial is not None else [0.0] * n,
            "formula_general": "x_i^(k+1) = (b_i - sum(A_ij * x_j)) / A_ii    para j != i",
            "despejes": despejes,
            "tolerancia": tol,
            "iteraciones": iteraciones,
            "total_iteraciones": iteracion,
            "convergio": convergio,
            "mensaje": mensaje
        }


# =========================================================================
# BLOQUE DE PRUEBA - Solo se ejecuta si corres este archivo directamente
# =========================================================================
if __name__ == "__main__":
    metodos = MetodosNumericos()

    print("=" * 70)
    print("REGRESIÓN BUG 3: tan(x) cerca de pi/2 NO debe declarar convergencia")
    print("=" * 70)
    r = metodos.newton_raphson("tan(x)", x0=1.570796, tol=0.001, max_iter=50)
    print(f"  Convergio: {r['convergio']}  (esperado: False)")
    print(f"  Mensaje: {r['mensaje']}")

    print("\n" + "=" * 70)
    print("REGRESIÓN BUG 8: x^(1/3) oscilante NO debe colgarse (timeout/cap)")
    print("=" * 70)
    r = metodos.newton_raphson("x**(1/3)", x0=1, tol=0.001, max_iter=50)
    print(f"  Convergio: {r['convergio']}  Iteraciones: {r['total_iteraciones']}")
    print(f"  Mensaje: {r['mensaje']}")

    print("\n" + "=" * 70)
    print("REGRESIÓN BUG 4: max_iter absurdo se capa a", MAX_ITER_CAP)
    print("=" * 70)
    r = metodos.newton_raphson("x**2 - 2", x0=1, tol=0.001, max_iter=999999999)
    print(f"  Convergio: {r['convergio']}  Iteraciones: {r['total_iteraciones']}  Raiz: {r['raiz']}")

    print("\n" + "=" * 70)
    print("CONTROL: casos que YA funcionaban deben seguir igual")
    print("=" * 70)
    print("  x^2-2:", metodos.newton_raphson("x**2 - 2", x0=1)['raiz'])
    print("  cos(x)-x:", metodos.newton_raphson("cos(x) - x", x0=1)['raiz'])
    print("  secante x^3-x-2:", metodos.secante("x**3 - x - 2", x0=1, x1=2)['raiz'])
    print("  muller x^2+1:", metodos.muller("x**2 + 1", x0=0, x1=1, x2=2)['raiz'])
    A = [[10, -1, 2], [-1, 11, -1], [2, -1, 10]]
    print("  gauss-seidel:", metodos.gauss_seidel(A, [6, 25, -11])['solucion'])