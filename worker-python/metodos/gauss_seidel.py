import time
from .base import clamp_iter, es_finito, MAX_SECONDS


def gauss_seidel(A, b, x_inicial=None, tol=0.001, max_iter=100):
    iteraciones = []
    max_iter = clamp_iter(max_iter)
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
                if not es_finito(x[i]):
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
    return {"solucion": x, "matriz_A": A_list, "vector_b": b_list,
            "vector_inicial": x_inicial if x_inicial is not None else [0.0] * n,
            "formula_general": "x_i^(k+1) = (b_i - sum(A_ij * x_j)) / A_ii    para j != i",
            "despejes": despejes, "tolerancia": tol,
            "iteraciones": iteraciones, "total_iteraciones": iteracion,
            "convergio": convergio, "mensaje": mensaje}
