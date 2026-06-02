import sys
import os

# Make the backend package importable from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: E402
from mangum import Mangum     # noqa: E402

handler = Mangum(app, lifespan="off")
