"""Crea un splash screen Android: fondo verde brand con el Cubex centrado."""
from PIL import Image

ICON = r"C:\Users\arvid\Documents\VoxelGobblin\DemoMaze2\artifacts\icon-source.png"
OUT  = r"C:\Users\arvid\Documents\VoxelGobblin\DemoMaze2\android\app\src\main\res\drawable\splash.png"

# Tamaño típico de splash (portrait 9:16, ~1080x1920)
W, H = 1080, 1920
# Color brand (verde del juego, del CSS del lobby)
BRAND = (45, 74, 31, 255)  # #2d4a1f

splash = Image.new("RGBA", (W, H), BRAND)
icon = Image.open(ICON).convert("RGBA")

# Centrar el icono a un tamaño razonable (~40% del ancho)
icon_size = int(W * 0.5)
icon_resized = icon.resize((icon_size, icon_size), Image.LANCZOS)

# Pegar centrado
x = (W - icon_size) // 2
y = (H - icon_size) // 2
splash.alpha_composite(icon_resized, (x, y))

splash.save(OUT)
print("splash -> " + OUT + " (" + str(W) + "x" + str(H) + ")")
