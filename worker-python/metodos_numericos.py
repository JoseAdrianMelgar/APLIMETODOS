import sympy as sp
import cmath


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

    # =====================================================================
    # MÉTODO 1: NEWTON-RAPHSON (con paso a paso completo)
    # =====================================================================
    def newton_raphson(self, funcion_str, x0, tol=0.001, max_iter=100, derivada_str=None):
        """
        Aplica el método de Newton-Raphson mostrando cada paso del cálculo.

        Parámetros:
            funcion_str (str): Función en string, ejemplo: "exp(-x) - x"
            x0 (float): Valor inicial.
            tol (float): Tolerancia del error relativo (en %). Por defecto 0.001.
            max_iter (int): Máximo de iteraciones. Por defecto 100.
            derivada_str (str, opcional): Derivada manual. Si no, se calcula con SymPy.

        Retorna:
            dict con:
                - raiz: valor aproximado de la raíz.
                - funcion: función original (str).
                - derivada: derivada usada (str).
                - derivada_calculada_automaticamente: True/False.
                - formula_general: fórmula del método en texto.
                - iteraciones: lista de pasos detallados por iteración.
                - convergio: True/False.
                - mensaje: descripción del resultado.
        """
        iteraciones = []

        try:
            # ----- PREPARACIÓN: parsear función y derivada -----
            f_expr = sp.sympify(funcion_str)

            derivada_auto = derivada_str is None
            if derivada_auto:
                df_expr = sp.diff(f_expr, self.x)
            else:
                df_expr = sp.sympify(derivada_str)

            # Convertir a funciones numéricas evaluables
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
                "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        x_n = float(x0)
        err = 100.0
        iteracion = 0

        # ----- CICLO PRINCIPAL CON PASO A PASO -----
        while err > tol and iteracion < max_iter:
            iteracion += 1
            x_ant = x_n

            try:
                # Paso 1: Evaluar f(x_i)
                f_xi = f(x_ant)

                # Paso 2: Evaluar f'(x_i)
                df_xi = df(x_ant)

                # Validar division por cero
                if abs(df_xi) < 1e-12:
                    return {
                        "raiz": None,
                        "funcion": funcion_str,
                        "derivada": str(df_expr),
                        "derivada_calculada_automaticamente": derivada_auto,
                        "formula_general": "x_{i+1} = x_i - f(x_i) / f'(x_i)",
                        "iteraciones": iteraciones,
                        "convergio": False,
                        "mensaje": (
                            f"Derivada cercana a cero en iteracion {iteracion} "
                            f"(f'({x_ant}) = {df_xi}). Division por cero."
                        )
                    }

                # Paso 3: Aplicar la formula
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
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            # Paso 4: Calcular error relativo porcentual
            if x_n != 0:
                err = abs((x_n - x_ant) / x_n) * 100
            else:
                err = abs(x_n - x_ant) * 100

            # ----- GUARDAR EL PASO A PASO DE ESTA ITERACION -----
            # Sustituir x por su valor numerico de forma simbolica (limpio)
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

        # ----- RESULTADO FINAL -----
        convergio = err <= tol
        mensaje = (
            f"Convergencia alcanzada en {iteracion} iteraciones."
            if convergio
            else f"No se alcanzo la convergencia en {max_iter} iteraciones."
        )

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
        """
        Aplica el método de la Secante mostrando cada paso del cálculo.

        A diferencia de Newton-Raphson, NO requiere la derivada: aproxima la
        pendiente con dos puntos consecutivos.

        Parámetros:
            funcion_str (str): Función en string, ejemplo: "x**3 - x - 2"
            x0 (float): Primer valor inicial.
            x1 (float): Segundo valor inicial.
            tol (float): Tolerancia del error relativo (en %). Por defecto 0.001.
            max_iter (int): Máximo de iteraciones. Por defecto 100.

        Retorna:
            dict con:
                - raiz: valor aproximado de la raíz.
                - funcion: función original (str).
                - formula_general: fórmula del método en texto.
                - iteraciones: lista de pasos detallados por iteración.
                - convergio: True/False.
                - mensaje: descripción del resultado.
        """
        iteraciones = []

        try:
            # ----- PREPARACIÓN: parsear función -----
            f_expr = sp.sympify(funcion_str)
            f = sp.lambdify(self.x, f_expr, 'math')

        except Exception as e:
            return {
                "raiz": None,
                "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                "iteraciones": [],
                "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        x_ant = float(x0)   # x_{i-1}
        x_act = float(x1)   # x_i
        err = 100.0
        iteracion = 0

        # ----- CICLO PRINCIPAL CON PASO A PASO -----
        while err > tol and iteracion < max_iter:
            iteracion += 1

            try:
                # Paso 1: Evaluar f(x_{i-1})
                f_x_ant = f(x_ant)

                # Paso 2: Evaluar f(x_i)
                f_x_act = f(x_act)

                # Validar division por cero (f(x_i) - f(x_{i-1}) ≈ 0)
                denominador = f_x_act - f_x_ant
                if abs(denominador) < 1e-12:
                    return {
                        "raiz": None,
                        "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                        "iteraciones": iteraciones,
                        "convergio": False,
                        "mensaje": (
                            f"Denominador cercano a cero en iteracion {iteracion} "
                            f"(f(x_i) - f(x_(i-1)) = {denominador}). Division por cero."
                        )
                    }

                # Paso 3: Aplicar la formula de la secante
                numerador = f_x_act * (x_act - x_ant)
                x_nuevo = x_act - (numerador / denominador)

            except ZeroDivisionError:
                return {
                    "raiz": None,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones,
                    "convergio": False,
                    "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "raiz": None,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_i - [f(x_i)*(x_i - x_{i-1})] / [f(x_i) - f(x_{i-1})]",
                    "iteraciones": iteraciones,
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            # Paso 4: Calcular error relativo porcentual
            if x_nuevo != 0:
                err = abs((x_nuevo - x_act) / x_nuevo) * 100
            else:
                err = abs(x_nuevo - x_act) * 100

            # ----- GUARDAR EL PASO A PASO DE ESTA ITERACION -----
            f_sustituido_ant = f_expr.subs(self.x, x_ant)
            f_sustituido_act = f_expr.subs(self.x, x_act)

            iteraciones.append({
                "iteracion": iteracion,
                "xi_anterior": x_ant,    # x_{i-1}
                "xi_actual": x_act,      # x_i
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

            # ----- ACTUALIZAR VALORES PARA SIGUIENTE ITERACION -----
            x_ant = x_act
            x_act = x_nuevo

        # ----- RESULTADO FINAL -----
        convergio = err <= tol
        mensaje = (
            f"Convergencia alcanzada en {iteracion} iteraciones."
            if convergio
            else f"No se alcanzo la convergencia en {max_iter} iteraciones."
        )

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
        """
        Aplica el método de Müller mostrando cada paso del cálculo.

        En lugar de una recta (como Secante), usa una parábola que pasa por
        tres puntos (x0, x1, x2) para aproximar la raíz. Soporta raíces
        complejas cuando el discriminante es negativo.

        Parámetros:
            funcion_str (str): Función en string, ejemplo: "x**3 - x - 2"
            x0 (float): Primer valor inicial.
            x1 (float): Segundo valor inicial.
            x2 (float): Tercer valor inicial.
            tol (float): Tolerancia del error relativo (en %). Por defecto 0.001.
            max_iter (int): Máximo de iteraciones. Por defecto 100.

        Retorna:
            dict con:
                - raiz: valor aproximado de la raíz (str si es compleja).
                - raiz_es_compleja: True/False.
                - funcion: función original (str).
                - formula_general: fórmula del método en texto.
                - iteraciones: lista de pasos detallados por iteración.
                - convergio: True/False.
                - mensaje: descripción del resultado.
        """
        iteraciones = []

        try:
            # ----- PREPARACIÓN: parsear función -----
            f_expr = sp.sympify(funcion_str)
            # Usar cmath para soportar raíces complejas en la evaluación
            f = sp.lambdify(self.x, f_expr, 'math')

        except Exception as e:
            return {
                "raiz": None,
                "raiz_es_compleja": False,
                "funcion": funcion_str,
                "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                "iteraciones": [],
                "convergio": False,
                "mensaje": f"Error al parsear la expresion: {str(e)}"
            }

        # Usar números complejos desde el inicio para soportar raíces complejas
        p0 = complex(x0)
        p1 = complex(x1)
        p2 = complex(x2)

        err = 100.0
        iteracion = 0

        # ----- CICLO PRINCIPAL CON PASO A PASO -----
        while err > tol and iteracion < max_iter:
            iteracion += 1

            try:
                # Evaluar la función en los tres puntos actuales
                f_p0 = complex(f(p0.real) if p0.imag == 0 else f(p0))
                f_p1 = complex(f(p1.real) if p1.imag == 0 else f(p1))
                f_p2 = complex(f(p2.real) if p2.imag == 0 else f(p2))

                # ----- PASO 1: Calcular diferencias h0 y h1 -----
                h0 = p1 - p0
                h1 = p2 - p1

                # ----- PASO 2: Calcular diferencias divididas δ0 y δ1 -----
                delta0 = (f_p1 - f_p0) / h0
                delta1 = (f_p2 - f_p1) / h1

                # ----- PASO 3: Calcular coeficientes de la parábola a, b, c -----
                a = (delta1 - delta0) / (h1 + h0)
                b = a * h1 + delta1
                c = f_p2

                # ----- PASO 4: Calcular el discriminante -----
                discriminante = b ** 2 - 4 * a * c
                raiz_disc = cmath.sqrt(discriminante)

                # ----- PASO 5: Elegir el denominador de mayor valor absoluto -----
                denom_mas  = b + raiz_disc
                denom_menos = b - raiz_disc

                if abs(denom_mas) >= abs(denom_menos):
                    denominador_elegido = denom_mas
                    signo_elegido = "+"
                else:
                    denominador_elegido = denom_menos
                    signo_elegido = "-"

                # Validar denominador cercano a cero
                if abs(denominador_elegido) < 1e-12:
                    return {
                        "raiz": None,
                        "raiz_es_compleja": False,
                        "funcion": funcion_str,
                        "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                        "iteraciones": iteraciones,
                        "convergio": False,
                        "mensaje": (
                            f"Denominador cercano a cero en iteracion {iteracion}. "
                            f"No se puede continuar."
                        )
                    }

                # ----- PASO 6: Calcular el nuevo punto -----
                p3 = p2 - (2 * c) / denominador_elegido

            except ZeroDivisionError:
                return {
                    "raiz": None,
                    "raiz_es_compleja": False,
                    "funcion": funcion_str,
                    "formula_general": "x_{i+1} = x_2 - (2*c) / (b ± sqrt(b^2 - 4*a*c))",
                    "iteraciones": iteraciones,
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
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            # ----- PASO 7: Calcular error relativo porcentual -----
            if abs(p3) > 1e-12:
                err = abs((p3 - p2) / p3) * 100
            else:
                err = abs(p3 - p2) * 100

            # Determinar si la raíz es compleja
            raiz_es_compleja = abs(p3.imag) > 1e-10

            # Formatear valores complejos para el paso a paso
            def fmt(v):
                """Formatea un complejo: si la parte imaginaria es ~0 muestra solo real."""
                if abs(v.imag) < 1e-10:
                    return str(v.real)
                return str(v)

            # ----- GUARDAR EL PASO A PASO DE ESTA ITERACION -----
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

            # ----- ACTUALIZAR VENTANA DE TRES PUNTOS -----
            p0 = p1
            p1 = p2
            p2 = p3

        # ----- RESULTADO FINAL -----
        err_final = err.real if hasattr(err, 'real') else err
        convergio = err_final <= tol
        raiz_es_compleja_final = abs(p2.imag) > 1e-10

        if raiz_es_compleja_final:
            raiz_final = str(p2)
            mensaje = (
                f"Raiz compleja encontrada en {iteracion} iteraciones: {raiz_final}."
                if convergio
                else f"No se alcanzo la convergencia en {max_iter} iteraciones (raiz compleja)."
            )
        else:
            raiz_final = p2.real
            mensaje = (
                f"Convergencia alcanzada en {iteracion} iteraciones."
                if convergio
                else f"No se alcanzo la convergencia en {max_iter} iteraciones."
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
        """
        Aplica el método iterativo de Gauss-Seidel para resolver Ax = b,
        mostrando el paso a paso de cada despeje en cada iteración.

        Es GENÉRICO: funciona con cualquier matriz cuadrada cuyos elementos
        diagonales sean distintos de cero. Despeja cada variable de su
        ecuación correspondiente y usa los valores recién calculados en la
        misma iteración (a diferencia de Jacobi).

        Parámetros:
            A (list de listas o array): Matriz cuadrada de coeficientes (n x n).
            b (list o array): Vector de términos independientes (longitud n).
            x_inicial (list, opcional): Vector inicial. Si no se da, se usan ceros.
            tol (float): Tolerancia del error relativo (en %). Por defecto 0.001.
            max_iter (int): Máximo de iteraciones. Por defecto 100.

        Retorna:
            dict con:
                - solucion: vector x con los valores finales.
                - matriz_A: matriz original.
                - vector_b: vector original.
                - formula_general: fórmula del método en texto.
                - despejes: cómo quedó despejada cada variable.
                - iteraciones: lista de pasos detallados por iteración.
                - convergio: True/False.
                - mensaje: descripción del resultado.
        """
        iteraciones = []

        try:
            # ----- VALIDACIONES BASICAS -----
            # Convertir a listas de listas / lista plana para no depender de numpy
            A_list = [list(map(float, fila)) for fila in A]
            b_list = list(map(float, b))

            n = len(A_list)

            # Verificar que la matriz sea cuadrada
            for fila in A_list:
                if len(fila) != n:
                    return {
                        "solucion": None,
                        "matriz_A": A_list,
                        "vector_b": b_list,
                        "iteraciones": [],
                        "convergio": False,
                        "mensaje": "Error: la matriz A no es cuadrada."
                    }

            # Verificar que b tenga la misma longitud
            if len(b_list) != n:
                return {
                    "solucion": None,
                    "matriz_A": A_list,
                    "vector_b": b_list,
                    "iteraciones": [],
                    "convergio": False,
                    "mensaje": (
                        f"Error: la longitud del vector b ({len(b_list)}) "
                        f"no coincide con el tamaño de la matriz A ({n})."
                    )
                }

            # Verificar que ningun elemento de la diagonal sea cero
            for i in range(n):
                if abs(A_list[i][i]) < 1e-12:
                    return {
                        "solucion": None,
                        "matriz_A": A_list,
                        "vector_b": b_list,
                        "iteraciones": [],
                        "convergio": False,
                        "mensaje": (
                            f"Error: el elemento diagonal A[{i}][{i}] es cero. "
                            f"Reordene las ecuaciones para evitar division por cero."
                        )
                    }

            # Vector inicial (por defecto ceros)
            if x_inicial is None:
                x = [0.0] * n
            else:
                if len(x_inicial) != n:
                    return {
                        "solucion": None,
                        "matriz_A": A_list,
                        "vector_b": b_list,
                        "iteraciones": [],
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
                "convergio": False,
                "mensaje": f"Error al preparar los datos: {str(e)}"
            }

        # ----- CONSTRUIR LOS DESPEJES (PARA MOSTRAR LA FORMA SIMBOLICA) -----
        # Para cada fila i: x_i = (b_i - sum(A_ij * x_j para j != i)) / A_ii
        despejes = []
        for i in range(n):
            terminos = []
            for j in range(n):
                if j != i:
                    coef = A_list[i][j]
                    # Escribir el termino con signo correcto
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

        # ----- CICLO PRINCIPAL CON PASO A PASO -----
        while err_max > tol and iteracion < max_iter:
            iteracion += 1

            x_anterior = list(x)  # snapshot antes de la iteracion
            pasos_variables = []

            try:
                for i in range(n):
                    # Guardar el valor previo SOLO de esta variable
                    xi_previo = x[i]

                    # Sumatoria de A_ij * x_j para j != i
                    # (uso x[j] que ya tiene los valores actualizados de esta iteracion
                    #  para los j < i, y los de la iteracion anterior para j > i)
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

                    # Despejar x_i
                    numerador = b_list[i] - suma
                    x[i] = numerador / A_list[i][i]

                    # Calcular error de esta variable
                    if x[i] != 0:
                        error_xi = abs((x[i] - xi_previo) / x[i]) * 100
                    else:
                        error_xi = abs(x[i] - xi_previo) * 100

                    # Construir el string de sustitucion completo para esta variable
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
                    "convergio": False,
                    "mensaje": f"Division por cero en iteracion {iteracion}."
                }
            except Exception as e:
                return {
                    "solucion": None,
                    "matriz_A": A_list,
                    "vector_b": b_list,
                    "iteraciones": iteraciones,
                    "convergio": False,
                    "mensaje": f"Error de evaluacion en iteracion {iteracion}: {str(e)}"
                }

            # Error de la iteracion = maximo error entre todas las variables
            err_max = max(p["error_variable"] for p in pasos_variables)

            iteraciones.append({
                "iteracion": iteracion,
                "x_anterior": x_anterior,
                "pasos_por_variable": pasos_variables,
                "x_nuevo": list(x),
                "error_maximo": err_max
            })

        # ----- RESULTADO FINAL -----
        convergio = err_max <= tol
        mensaje = (
            f"Convergencia alcanzada en {iteracion} iteraciones."
            if convergio
            else f"No se alcanzo la convergencia en {max_iter} iteraciones."
        )

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

    # ====================================================================
    # PRUEBA 1: NEWTON-RAPHSON con f(x) = e^(-x) - x
    # ====================================================================
    print("=" * 70)
    print("PRUEBA 1: NEWTON-RAPHSON con f(x) = e^(-x) - x, x0 = 0")
    print("=" * 70)

    resultado_nr = metodos.newton_raphson(
        funcion_str="exp(-x) - x",
        x0=0,
        tol=0.001,
        max_iter=100
    )

    print(f"\nFuncion: {resultado_nr['funcion']}")
    print(f"Derivada usada: {resultado_nr['derivada']}")
    print(f"Calculada automaticamente: {resultado_nr['derivada_calculada_automaticamente']}")
    print(f"Formula general: {resultado_nr['formula_general']}")
    print(f"\nRaiz encontrada: {resultado_nr['raiz']}")
    print(f"Convergio: {resultado_nr['convergio']}")
    print(f"Total iteraciones: {resultado_nr['total_iteraciones']}")
    print(f"Mensaje: {resultado_nr['mensaje']}")

    print("\n--- PASO A PASO DE CADA ITERACION ---")
    for it in resultado_nr['iteraciones']:
        print(f"\n>>> ITERACION {it['iteracion']}")
        print(f"  xi anterior: {it['xi_anterior']}")
        print(f"  Paso 1 - Evaluar f(xi):")
        print(f"    {it['paso_1_evaluar_funcion']['expresion']}")
        print(f"    = {it['paso_1_evaluar_funcion']['resultado']}")
        print(f"  Paso 2 - Evaluar f'(xi):")
        print(f"    {it['paso_2_evaluar_derivada']['expresion']}")
        print(f"    = {it['paso_2_evaluar_derivada']['resultado']}")
        print(f"  Paso 3 - Aplicar formula:")
        print(f"    {it['paso_3_aplicar_formula']['sustitucion']}")
        print(f"    xi_nuevo = {it['paso_3_aplicar_formula']['resultado']}")
        print(f"  Paso 4 - Calcular error:")
        print(f"    {it['paso_4_calcular_error']['sustitucion']}")
        print(f"    error = {it['paso_4_calcular_error']['resultado']:.4f}%")

    # ====================================================================
    # PRUEBA 2: SECANTE con f(x) = x^3 - x - 2
    # ====================================================================
    print("\n\n" + "=" * 70)
    print("PRUEBA 2: SECANTE con f(x) = x^3 - x - 2, x0 = 1, x1 = 2")
    print("=" * 70)

    resultado_sec = metodos.secante(
        funcion_str="x**3 - x - 2",
        x0=1,
        x1=2,
        tol=0.001,
        max_iter=100
    )

    print(f"\nFuncion: {resultado_sec['funcion']}")
    print(f"Formula general: {resultado_sec['formula_general']}")
    print(f"\nRaiz encontrada: {resultado_sec['raiz']}")
    print(f"Convergio: {resultado_sec['convergio']}")
    print(f"Total iteraciones: {resultado_sec['total_iteraciones']}")
    print(f"Mensaje: {resultado_sec['mensaje']}")

    print("\n--- PASO A PASO DE CADA ITERACION ---")
    for it in resultado_sec['iteraciones']:
        print(f"\n>>> ITERACION {it['iteracion']}")
        print(f"  x_(i-1) = {it['xi_anterior']}")
        print(f"  x_i     = {it['xi_actual']}")
        print(f"  Paso 3 - Aplicar formula:")
        print(f"    {it['paso_3_aplicar_formula']['sustitucion']}")
        print(f"    xi_nuevo = {it['paso_3_aplicar_formula']['resultado']}")
        print(f"  Paso 4 - Calcular error:")
        print(f"    {it['paso_4_calcular_error']['sustitucion']}")
        print(f"    error = {it['paso_4_calcular_error']['resultado']:.4f}%")

    # ====================================================================
    # PRUEBA 3: MÜLLER con f(x) = x^3 - x - 2  (misma función que Secante)
    # ====================================================================
    print("\n\n" + "=" * 70)
    print("PRUEBA 3: MÜLLER con f(x) = x^3 - x - 2, x0=0, x1=1, x2=2")
    print("=" * 70)

    resultado_mul = metodos.muller(
        funcion_str="x**3 - x - 2",
        x0=0,
        x1=1,
        x2=2,
        tol=0.001,
        max_iter=100
    )

    print(f"\nFuncion: {resultado_mul['funcion']}")
    print(f"Formula general: {resultado_mul['formula_general']}")
    print(f"\nRaiz encontrada: {resultado_mul['raiz']}")
    print(f"Raiz es compleja: {resultado_mul['raiz_es_compleja']}")
    print(f"Convergio: {resultado_mul['convergio']}")
    print(f"Total iteraciones: {resultado_mul['total_iteraciones']}")
    print(f"Mensaje: {resultado_mul['mensaje']}")

    print("\n--- PASO A PASO DE CADA ITERACION ---")
    for it in resultado_mul['iteraciones']:
        print(f"\n>>> ITERACION {it['iteracion']}")
        print(f"  x0={it['x0_actual']}  x1={it['x1_actual']}  x2={it['x2_actual']}")
        p1 = it['paso_1_diferencias_h']
        print(f"  Paso 1 - Diferencias h:")
        print(f"    {p1['sustitucion_h0']}")
        print(f"    {p1['sustitucion_h1']}")
        p2 = it['paso_2_diferencias_divididas']
        print(f"  Paso 2 - Diferencias divididas:")
        print(f"    {p2['sustitucion_d0']}")
        print(f"    {p2['sustitucion_d1']}")
        p3 = it['paso_3_coeficientes_parabola']
        print(f"  Paso 3 - Coeficientes a,b,c:")
        print(f"    a={p3['a']}  b={p3['b']}  c={p3['c']}")
        p4 = it['paso_4_discriminante']
        print(f"  Paso 4 - Discriminante: {p4['discriminante']}  (raiz={p4['raiz_discriminante']})")
        p5 = it['paso_5_elegir_denominador']
        print(f"  Paso 5 - Denominador elegido (signo {p5['signo_elegido']}): {p5['denominador_elegido']}")
        p6 = it['paso_6_nuevo_punto']
        print(f"  Paso 6 - Nuevo punto: {p6['resultado']}")
        p7 = it['paso_7_calcular_error']
        print(f"  Paso 7 - Error: {p7['resultado']:.4f}%")

    # ====================================================================
    # PRUEBA 4: MÜLLER con raíz compleja — f(x) = x^2 + 1
    # ====================================================================
    print("\n\n" + "=" * 70)
    print("PRUEBA 4: MÜLLER con raiz compleja — f(x) = x^2 + 1")
    print("=" * 70)

    resultado_cmplx = metodos.muller(
        funcion_str="x**2 + 1",
        x0=0,
        x1=1,
        x2=2,
        tol=0.001,
        max_iter=100
    )

    print(f"\nRaiz encontrada: {resultado_cmplx['raiz']}")
    print(f"Raiz es compleja: {resultado_cmplx['raiz_es_compleja']}")
    print(f"Convergio: {resultado_cmplx['convergio']}")
    print(f"Mensaje: {resultado_cmplx['mensaje']}")

    # ====================================================================
    # PRUEBA 5: GAUSS-SEIDEL para sistema 3x3
    # ====================================================================
    print("\n\n" + "=" * 70)
    print("PRUEBA 5: GAUSS-SEIDEL para sistema 3x3")
    print("=" * 70)

    A = [
        [10, -1,  2],
        [-1, 11, -1],
        [2, -1, 10]
    ]
    b = [6, 25, -11]

    resultado_gs = metodos.gauss_seidel(
        A=A,
        b=b,
        x_inicial=[0, 0, 0],
        tol=0.001,
        max_iter=100
    )

    print(f"\nSolucion encontrada: {resultado_gs['solucion']}")
    print(f"Convergio: {resultado_gs['convergio']}")
    print(f"Total iteraciones: {resultado_gs['total_iteraciones']}")
    print(f"Mensaje: {resultado_gs['mensaje']}")
