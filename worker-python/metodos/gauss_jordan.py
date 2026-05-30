import copy


def gauss_jordan(A, b):
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
        max_row = col
        for row in range(col + 1, n):
            if abs(M[row][col]) > abs(M[max_row][col]):
                max_row = row
        if abs(M[max_row][col]) < 1e-12:
            return {"solucion": None, "matriz_A": A_list, "vector_b": b_list,
                    "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
                    "convergio": False,
                    "mensaje": f"Matriz singular: pivote cero en columna {col+1}. El sistema no tiene solucion unica."}
        if max_row != col:
            paso += 1
            M_antes = copy.deepcopy(M)
            M[col], M[max_row] = M[max_row], M[col]
            iteraciones.append({
                "iteracion": paso, "tipo": "pivoteo",
                "descripcion": f"Intercambio  F{col+1} <-> F{max_row+1}  (pivote = {M[col][col]:.6g})",
                "fila_1": col + 1, "fila_2": max_row + 1,
                "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                "filas_cambiadas": [col, max_row],
                "xi_nuevo": None, "error": 0.0,
            })
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
                "descripcion": f"F{row+1}  =  F{row+1}  -  ({factor:.6g}) x F{col+1}",
                "fila_pivote": col + 1, "fila_objetivo": row + 1, "factor": factor,
                "matriz_antes": M_antes, "matriz_despues": copy.deepcopy(M),
                "fila_cambiada": row,
                "xi_nuevo": None, "error": 0.0,
            })
    x = [M[i][n] for i in range(n)]
    paso += 1
    iteraciones.append({
        "iteracion": paso, "tipo": "solucion",
        "descripcion": "Lectura directa: columna derecha de [I|x]",
        "solucion_parcial": x[:], "x_nuevo": x[:],
        "xi_nuevo": None, "error": 0.0,
    })
    return {"solucion": x, "matriz_A": A_list, "vector_b": b_list,
            "matriz_aumentada_inicial": M_inicial,
            "matriz_aumentada_final": copy.deepcopy(M),
            "formula_general": "Eliminacion Gauss-Jordan (RREF [I|x])",
            "iteraciones": iteraciones, "total_iteraciones": len(iteraciones),
            "convergio": True, "tolerancia": None,
            "mensaje": f"Matriz reducida a RREF en {len(iteraciones)} pasos. Solucion leida directamente."}
