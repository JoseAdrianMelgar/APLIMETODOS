import sympy as sp
import math
import re

# Constantes de seguridad (identicas al original)
MAX_ITER_CAP        = 1000
MAX_SECONDS         = 15
MAX_FUNC_LEN        = 120
RESIDUO_MAX         = 1.0
PICO_DISCONTINUIDAD = 1e3

# Simbolo simbolico compartido (antes era self.x)
x_sym = sp.symbols('x')


def normalize_funcion(s: str) -> str:
    UNICODE_SUP = {'\u2070':'**0','\u00b9':'**1','\u00b2':'**2','\u00b3':'**3','\u2074':'**4',
                   '\u2075':'**5','\u2076':'**6','\u2077':'**7','\u2078':'**8','\u2079':'**9'}
    for u, r in UNICODE_SUP.items():
        s = s.replace(u, r)
    return (s.replace('^', '**')
             .replace('\u00d7', '*')
             .replace('\u00f7', '/'))


def parse_funcion(funcion_str):
    try:
        normalizada = normalize_funcion(funcion_str)
        normalizada = re.sub(r'\be\b', 'E', normalizada)
        return sp.sympify(normalizada)
    except Exception:
        raise ValueError(
            f"Funcion invalida: '{funcion_str}'."
        )


def clamp_iter(max_iter):
    try:
        m = int(max_iter)
    except (TypeError, ValueError):
        return 100
    if m < 1:   return 1
    if m > MAX_ITER_CAP: return MAX_ITER_CAP
    return m


def es_finito(valor):
    try:
        if isinstance(valor, complex):
            return math.isfinite(valor.real) and math.isfinite(valor.imag)
        return math.isfinite(float(valor))
    except (TypeError, ValueError):
        return False


def funcion_invalida(funcion_str):
    return funcion_str is None or len(str(funcion_str)) > MAX_FUNC_LEN
