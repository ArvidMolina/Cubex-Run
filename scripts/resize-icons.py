"""Genera todos los tamaños del icono Android desde el render del personaje.
Usa PIL (Pillow) con interpolación Lanczos para mantener nitidez al upscalling.
"""
from PIL import Image
import os, sys

SRC = r"C:\Users\arvid\Documents\VoxelGobblin\DemoMaze2\artifacts\icon-source.png"
ANDROID = r"C:\Users\arvid\Documents\VoxelGobblin\DemoMaze2\android\app\src\main\res"

# Tamaño destino: Play Store + mdpi .. xxxhdpi
SIZES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

src = Image.open(SRC).convert("RGBA")
print(f"origen: {src.size}")

# 512x512 para Play Store y fuente de alta calidad
hi = src.resize((512, 512), Image.LANCZOS)
hi.save(os.path.join(ANDROID, "icon-512.png"))
print("icon-512.png")

for folder, size in SIZES.items():
    out_dir = os.path.join(ANDROID, folder)
    os.makedirs(out_dir, exist_ok=True)
    img = src.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(out_dir, "ic_launcher.png"))
    img.save(os.path.join(out_dir, "ic_launcher_round.png"))
    print(f"{folder}: ic_launcher.png + ic_launcher_round.png ({size}x{size})")

print("OK")
