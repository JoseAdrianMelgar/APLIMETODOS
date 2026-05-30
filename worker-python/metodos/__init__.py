from .newton_raphson import newton_raphson
from .secante       import secante
from .muller        import muller
from .gauss         import gauss
from .gauss_seidel  import gauss_seidel
from .gauss_jordan  import gauss_jordan


class MetodosNumericos:
    """Fachada que delega cada metodo a su modulo independiente."""
    def newton_raphson(self, *a, **kw): return newton_raphson(*a, **kw)
    def secante(self,        *a, **kw): return secante(*a, **kw)
    def muller(self,         *a, **kw): return muller(*a, **kw)
    def gauss(self,          *a, **kw): return gauss(*a, **kw)
    def gauss_seidel(self,   *a, **kw): return gauss_seidel(*a, **kw)
    def gauss_jordan(self,   *a, **kw): return gauss_jordan(*a, **kw)
