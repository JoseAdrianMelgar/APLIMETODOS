import sympy as sp


class MetodosNumericos:
    """
    Clase que agrupa los métodos numéricos del proyecto.

    Cada función retorna un diccionario con:
      - El resultado final (raíz, fx, etc.)
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
    # MÉTODO 2: INTERPOLACIÓN LINEAL (con paso a paso completo)
    # =====================================================================
    def interpolacion_lineal(self, x0, f0, x1, f1, x, valor_real=None):
        """
        Aplica interpolacion lineal mostrando el paso a paso del calculo.

        Parametros:
            x0, f0: Primer punto conocido.
            x1, f1: Segundo punto conocido.
            x: Valor donde se desea estimar f(x).
            valor_real (float, opcional): Valor real para calcular error.

        Retorna:
            dict con el paso a paso completo de la sustitucion y simplificacion.
        """
        try:
            # ----- VALIDACION -----
            if x1 == x0:
                return {
                    "fx": None,
                    "convergio": False,
                    "mensaje": "Error: x0 y x1 no pueden ser iguales (division por cero)."
                }

            # ----- PASO 1: Plantear la formula general -----
            formula_general = "f1(x) ~= f(x0) + [(f(x1) - f(x0)) / (x1 - x0)] * (x - x0)"

            # ----- PASO 2: Sustituir los valores en la formula -----
            sustitucion = (
                f"f1({x}) = {f0} + [({f1} - {f0}) / ({x1} - {x0})] * ({x} - {x0})"
            )

            # ----- PASO 3: Calcular la pendiente (diferencia dividida) -----
            numerador_pendiente = f1 - f0
            denominador_pendiente = x1 - x0
            pendiente = numerador_pendiente / denominador_pendiente

            calculo_pendiente = {
                "formula": "(f(x1) - f(x0)) / (x1 - x0)",
                "sustitucion": f"({f1} - {f0}) / ({x1} - {x0})",
                "simplificacion": f"{numerador_pendiente} / {denominador_pendiente}",
                "resultado": pendiente
            }

            # ----- PASO 4: Calcular el desplazamiento (x - x0) -----
            desplazamiento = x - x0

            calculo_desplazamiento = {
                "formula": "(x - x0)",
                "sustitucion": f"({x} - {x0})",
                "resultado": desplazamiento
            }

            # ----- PASO 5: Multiplicar pendiente por desplazamiento -----
            producto = pendiente * desplazamiento

            calculo_producto = {
                "formula": "pendiente * (x - x0)",
                "sustitucion": f"{pendiente} * {desplazamiento}",
                "resultado": producto
            }

            # ----- PASO 6: Sumar f(x0) para obtener el resultado final -----
            fx = f0 + producto

            calculo_final = {
                "formula": "f(x0) + pendiente * (x - x0)",
                "sustitucion": f"{f0} + {producto}",
                "resultado": fx
            }

            # ----- PASO 7: Calcular error relativo (si hay valor real) -----
            error_relativo = None
            calculo_error = None
            if valor_real is not None and valor_real != 0:
                diferencia = abs(valor_real - fx)
                error_relativo = (diferencia / abs(valor_real)) * 100

                calculo_error = {
                    "formula": "er = |valor_real - fx| / |valor_real| * 100%",
                    "sustitucion": f"er = |{valor_real} - {fx}| / |{valor_real}| * 100%",
                    "diferencia": diferencia,
                    "resultado": error_relativo
                }

            # ----- ENTREGAR EL PASO A PASO COMPLETO -----
            return {
                "fx": fx,
                "puntos_conocidos": {
                    "x0": x0, "f0": f0,
                    "x1": x1, "f1": f1
                },
                "x_a_estimar": x,
                "valor_real": valor_real,
                "formula_general": formula_general,
                "paso_a_paso": {
                    "paso_1_sustitucion_inicial": sustitucion,
                    "paso_2_calcular_pendiente": calculo_pendiente,
                    "paso_3_calcular_desplazamiento": calculo_desplazamiento,
                    "paso_4_multiplicar": calculo_producto,
                    "paso_5_resultado_final": calculo_final,
                    "paso_6_calcular_error": calculo_error
                },
                "error_relativo": error_relativo,
                "convergio": True,
                "mensaje": f"Interpolacion lineal calculada correctamente para x = {x}."
            }

        except Exception as e:
            return {
                "fx": None,
                "convergio": False,
                "mensaje": f"Error en interpolacion lineal: {str(e)}"
            }

    # =====================================================================
    # MÉTODO 3: INTERPOLACIÓN CUADRÁTICA (con paso a paso completo)
    # =====================================================================
    def interpolacion_cuadratica(self, x0, f0, x1, f1, x2, f2, x, valor_real=None):
        """
        Aplica interpolacion cuadratica mostrando el paso a paso completo,
        tal como el catedratico lo ensena en clase (calculo de a0, a1, a2
        con diferencias divididas de Newton).

        Parametros:
            x0, f0: Primer punto.
            x1, f1: Segundo punto.
            x2, f2: Tercer punto.
            x: Valor donde se desea estimar f(x).
            valor_real (float, opcional): Valor real para calcular error.

        Retorna:
            dict con el paso a paso de cada coeficiente y la evaluacion final.
        """
        try:
            # ----- VALIDACION -----
            if x1 == x0 or x2 == x1 or x2 == x0:
                return {
                    "fx": None,
                    "convergio": False,
                    "mensaje": "Error: los puntos x0, x1 y x2 deben ser distintos."
                }

            # ----- FORMULA GENERAL -----
            formula_general = "f2(x) ~= a0 + a1*(x - x0) + a2*(x - x0)*(x - x1)"

            # ----- PASO 1: Calcular a0 = f(x0) -----
            a0 = f0
            paso_a0 = {
                "formula": "a0 = f(x0)",
                "sustitucion": f"a0 = f({x0}) = {f0}",
                "resultado": a0,
                "interpretacion": (
                    "a0 es el valor de arranque del polinomio. "
                    "Cuando x = x0, los demas terminos se cancelan."
                )
            }

            # ----- PASO 2: Calcular a1 (primera diferencia dividida) -----
            numerador_a1 = f1 - f0
            denominador_a1 = x1 - x0
            a1 = numerador_a1 / denominador_a1

            paso_a1 = {
                "formula": "a1 = (f(x1) - f(x0)) / (x1 - x0)",
                "sustitucion": f"a1 = ({f1} - {f0}) / ({x1} - {x0})",
                "simplificacion": f"a1 = {numerador_a1} / {denominador_a1}",
                "resultado": a1,
                "interpretacion": (
                    "a1 es la pendiente entre los dos primeros puntos "
                    "(equivale a la pendiente de la interpolacion lineal)."
                )
            }

            # ----- PASO 3: Calcular la diferencia dividida intermedia [x1, x2] -----
            num_dif_x1x2 = f2 - f1
            den_dif_x1x2 = x2 - x1
            dif_x1x2 = num_dif_x1x2 / den_dif_x1x2

            paso_diferencia_dividida = {
                "formula": "f[x1, x2] = (f(x2) - f(x1)) / (x2 - x1)",
                "sustitucion": f"f[x1, x2] = ({f2} - {f1}) / ({x2} - {x1})",
                "simplificacion": f"f[x1, x2] = {num_dif_x1x2} / {den_dif_x1x2}",
                "resultado": dif_x1x2,
                "interpretacion": (
                    "Paso intermedio: pendiente entre los puntos x1 y x2."
                )
            }

            # ----- PASO 4: Calcular a2 (segunda diferencia dividida) -----
            numerador_a2 = dif_x1x2 - a1
            denominador_a2 = x2 - x0
            a2 = numerador_a2 / denominador_a2

            paso_a2 = {
                "formula": "a2 = (f[x1, x2] - a1) / (x2 - x0)",
                "sustitucion": f"a2 = ({dif_x1x2} - {a1}) / ({x2} - {x0})",
                "simplificacion": f"a2 = {numerador_a2} / {denominador_a2}",
                "resultado": a2,
                "interpretacion": (
                    "a2 captura la curvatura del polinomio (segunda diferencia dividida)."
                )
            }

            # ----- PASO 5: Evaluar el polinomio f2(x) paso por paso -----
            termino_1 = a0
            termino_2 = a1 * (x - x0)
            termino_3 = a2 * (x - x0) * (x - x1)

            paso_evaluacion = {
                "formula": "f2(x) = a0 + a1*(x - x0) + a2*(x - x0)*(x - x1)",
                "sustitucion_completa": (
                    f"f2({x}) = {a0} + {a1}*({x} - {x0}) + {a2}*({x} - {x0})*({x} - {x1})"
                ),
                "termino_1": {
                    "expresion": "a0",
                    "valor": termino_1
                },
                "termino_2": {
                    "expresion": f"a1*(x - x0) = {a1}*({x} - {x0})",
                    "calculo": f"{a1} * {x - x0}",
                    "valor": termino_2
                },
                "termino_3": {
                    "expresion": (
                        f"a2*(x - x0)*(x - x1) = {a2}*({x} - {x0})*({x} - {x1})"
                    ),
                    "calculo": f"{a2} * {x - x0} * {x - x1}",
                    "valor": termino_3
                },
                "suma_final": f"{termino_1} + {termino_2} + {termino_3}"
            }

            # Resultado final
            fx = termino_1 + termino_2 + termino_3

            # ----- PASO 6: Calcular error relativo (si hay valor real) -----
            error_relativo = None
            calculo_error = None
            if valor_real is not None and valor_real != 0:
                diferencia = abs(valor_real - fx)
                error_relativo = (diferencia / abs(valor_real)) * 100

                calculo_error = {
                    "formula": "er = |valor_real - fx| / |valor_real| * 100%",
                    "sustitucion": f"er = |{valor_real} - {fx}| / |{valor_real}| * 100%",
                    "diferencia": diferencia,
                    "resultado": error_relativo
                }

            # ----- ENTREGAR EL PASO A PASO COMPLETO -----
            return {
                "fx": fx,
                "puntos_conocidos": {
                    "x0": x0, "f0": f0,
                    "x1": x1, "f1": f1,
                    "x2": x2, "f2": f2
                },
                "x_a_estimar": x,
                "valor_real": valor_real,
                "formula_general": formula_general,
                "coeficientes": {
                    "a0": a0,
                    "a1": a1,
                    "a2": a2
                },
                "paso_a_paso": {
                    "paso_1_calcular_a0": paso_a0,
                    "paso_2_calcular_a1": paso_a1,
                    "paso_3_diferencia_dividida_x1x2": paso_diferencia_dividida,
                    "paso_4_calcular_a2": paso_a2,
                    "paso_5_evaluar_polinomio": paso_evaluacion,
                    "paso_6_calcular_error": calculo_error
                },
                "resultado_final": fx,
                "error_relativo": error_relativo,
                "convergio": True,
                "mensaje": f"Interpolacion cuadratica calculada correctamente para x = {x}."
            }

        except Exception as e:
            return {
                "fx": None,
                "convergio": False,
                "mensaje": f"Error en interpolacion cuadratica: {str(e)}"
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
    # PRUEBA 2: INTERPOLACION LINEAL para estimar ln(10)
    # ====================================================================
    print("\n\n" + "=" * 70)
    print("PRUEBA 2: INTERPOLACION LINEAL para estimar ln(10)")
    print("=" * 70)

    resultado_lin = metodos.interpolacion_lineal(
        x0=8, f0=2.079442,
        x1=12, f1=2.484907,
        x=10,
        valor_real=2.302585
    )

    print(f"\nPuntos conocidos: {resultado_lin['puntos_conocidos']}")
    print(f"x a estimar: {resultado_lin['x_a_estimar']}")
    print(f"Valor real (referencia): {resultado_lin['valor_real']}")
    print(f"Formula general: {resultado_lin['formula_general']}")

    print("\n--- PASO A PASO ---")
    pasos = resultado_lin['paso_a_paso']

    print(f"\nPaso 1 - Sustitucion inicial:")
    print(f"  {pasos['paso_1_sustitucion_inicial']}")

    print(f"\nPaso 2 - Calcular pendiente:")
    p2 = pasos['paso_2_calcular_pendiente']
    print(f"  Formula: {p2['formula']}")
    print(f"  Sustitucion: {p2['sustitucion']}")
    print(f"  Simplificacion: {p2['simplificacion']}")
    print(f"  Resultado: {p2['resultado']}")

    print(f"\nPaso 3 - Calcular desplazamiento (x - x0):")
    p3 = pasos['paso_3_calcular_desplazamiento']
    print(f"  {p3['sustitucion']} = {p3['resultado']}")

    print(f"\nPaso 4 - Multiplicar pendiente por desplazamiento:")
    p4 = pasos['paso_4_multiplicar']
    print(f"  {p4['sustitucion']} = {p4['resultado']}")

    print(f"\nPaso 5 - Resultado final:")
    p5 = pasos['paso_5_resultado_final']
    print(f"  {p5['sustitucion']} = {p5['resultado']:.6f}")

    if pasos['paso_6_calcular_error']:
        print(f"\nPaso 6 - Calcular error relativo:")
        p6 = pasos['paso_6_calcular_error']
        print(f"  {p6['sustitucion']}")
        print(f"  er = {p6['resultado']:.4f}%")

    # ====================================================================
    # PRUEBA 3: INTERPOLACION CUADRATICA para estimar ln(10)
    # ====================================================================
    print("\n\n" + "=" * 70)
    print("PRUEBA 3: INTERPOLACION CUADRATICA para estimar ln(10)")
    print("=" * 70)

    resultado_cuad = metodos.interpolacion_cuadratica(
        x0=8, f0=2.079442,
        x1=12, f1=2.484907,
        x2=11, f2=2.397895,
        x=10,
        valor_real=2.302585
    )

    print(f"\nPuntos conocidos: {resultado_cuad['puntos_conocidos']}")
    print(f"x a estimar: {resultado_cuad['x_a_estimar']}")
    print(f"Valor real (referencia): {resultado_cuad['valor_real']}")
    print(f"Formula general: {resultado_cuad['formula_general']}")

    print("\n--- PASO A PASO ---")
    pasos = resultado_cuad['paso_a_paso']

    print(f"\nPaso 1 - Calcular a0:")
    p1 = pasos['paso_1_calcular_a0']
    print(f"  Formula: {p1['formula']}")
    print(f"  Sustitucion: {p1['sustitucion']}")
    print(f"  Resultado: a0 = {p1['resultado']}")
    print(f"  Interpretacion: {p1['interpretacion']}")

    print(f"\nPaso 2 - Calcular a1:")
    p2 = pasos['paso_2_calcular_a1']
    print(f"  Formula: {p2['formula']}")
    print(f"  Sustitucion: {p2['sustitucion']}")
    print(f"  Simplificacion: {p2['simplificacion']}")
    print(f"  Resultado: a1 = {p2['resultado']:.6f}")

    print(f"\nPaso 3 - Diferencia dividida [x1, x2]:")
    p3 = pasos['paso_3_diferencia_dividida_x1x2']
    print(f"  Formula: {p3['formula']}")
    print(f"  Sustitucion: {p3['sustitucion']}")
    print(f"  Simplificacion: {p3['simplificacion']}")
    print(f"  Resultado: f[x1, x2] = {p3['resultado']:.6f}")

    print(f"\nPaso 4 - Calcular a2:")
    p4 = pasos['paso_4_calcular_a2']
    print(f"  Formula: {p4['formula']}")
    print(f"  Sustitucion: {p4['sustitucion']}")
    print(f"  Simplificacion: {p4['simplificacion']}")
    print(f"  Resultado: a2 = {p4['resultado']:.6f}")

    print(f"\nPaso 5 - Evaluar polinomio f2({resultado_cuad['x_a_estimar']}):")
    p5 = pasos['paso_5_evaluar_polinomio']
    print(f"  Formula: {p5['formula']}")
    print(f"  Sustitucion completa:")
    print(f"    {p5['sustitucion_completa']}")
    print(f"  Termino 1 (a0): {p5['termino_1']['valor']}")
    print(f"  Termino 2 (a1*(x-x0)): {p5['termino_2']['calculo']} = {p5['termino_2']['valor']:.6f}")
    print(f"  Termino 3 (a2*(x-x0)*(x-x1)): {p5['termino_3']['calculo']} = {p5['termino_3']['valor']:.6f}")
    print(f"  Suma final: {p5['suma_final']}")
    print(f"\n  >>> RESULTADO: f2({resultado_cuad['x_a_estimar']}) = {resultado_cuad['fx']:.6f}")

    if pasos['paso_6_calcular_error']:
        print(f"\nPaso 6 - Calcular error relativo:")
        p6 = pasos['paso_6_calcular_error']
        print(f"  {p6['sustitucion']}")
        print(f"  er = {p6['resultado']:.4f}%")
