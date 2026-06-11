"""Recorta los sprite sheets de la mascota en assets individuales por pose."""
from PIL import Image
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'assets', 'mascot')

s1 = Image.open(os.path.join(BASE, 'avatar3d-set-pilares.png')).convert('RGBA')
s2 = Image.open(os.path.join(BASE, 'avatar3d-set-poses.png')).convert('RGBA')
print('sheet1', s1.size, s1.mode, 'corner alpha:', s1.getpixel((5, 5)))
print('sheet2', s2.size, s2.mode, 'corner alpha:', s2.getpixel((5, 5)))


def save_trimmed(img, name, pad=8):
    alpha = img.getchannel('A')
    bbox = alpha.getbbox()
    if bbox:
        left = max(bbox[0] - pad, 0)
        top = max(bbox[1] - pad, 0)
        right = min(bbox[2] + pad, img.width)
        bottom = min(bbox[3] + pad, img.height)
        img = img.crop((left, top, right, bottom))
    img.save(os.path.join(BASE, name), optimize=True)
    print(name, img.size)


# Sheet 1: borrar texto del encabezado (zona segura, no toca al personaje)
clear = Image.new('RGBA', (530, 210), (0, 0, 0, 0))
s1.paste(clear, (0, 0))

save_trimmed(s1.crop((360, 40, 1020, 1060)), 'hero.png')
save_trimmed(s1.crop((15, 1055, 345, 1448)), 'card-training.png')
save_trimmed(s1.crop((350, 1055, 690, 1448)), 'card-nutrition.png')
save_trimmed(s1.crop((690, 1055, 1018, 1448)), 'card-progress.png')

# Sheet 2: grilla 2x2
save_trimmed(s2.crop((0, 0, 512, 768)), 'pose-training.png')
save_trimmed(s2.crop((512, 0, 1024, 768)), 'pose-rest.png')
save_trimmed(s2.crop((0, 768, 512, 1536)), 'pose-nutrition.png')
save_trimmed(s2.crop((512, 768, 1024, 1536)), 'pose-progress.png')
