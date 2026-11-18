"""Rend public/icons/icon.svg (mêmes formes) en PNG avec Pillow. Usage : python3 scripts/generate-icons.py public/icons"""
import sys
from PIL import Image, ImageDraw

BG = (255, 244, 214, 255)

def bez(p0, p1, p2, p3, n=400):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append((u**3*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t**3*p3[0],
                    u**3*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t**3*p3[1]))
    return out

# Courbe orange : C puis S (S réfléchit le 2e point de contrôle précédent)
orange = bez((120,330),(170,200),(230,380),(290,250)) + bez((290,250),(350,120),(380,170),(400,230))[1:]
blue = bez((130,390),(200,340),(300,420),(390,350))

def stroke(d, pts, color, w, s):
    pts = [(x*s, y*s) for x, y in pts]
    r = w*s/2
    for x, y in pts:
        d.ellipse((x-r, y-r, x+r, y+r), fill=color)

def render(size, content=1.0):
    ss = 4; big = size*ss
    img = Image.new('RGBA', (big, big), BG)
    d = ImageDraw.Draw(img)
    s = big*content/512; off = big*(1-content)/2
    def sh(pts): return [(x + off/s, y + off/s) for x, y in pts]
    stroke(d, sh(orange), (224,122,16,255), 34, s)
    stroke(d, sh(blue), (31,95,214,255), 26, s)
    cx, cy = (380+off/s)*s, (140+off/s)*s; r = 34*s
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(46,157,74,255))
    return img.resize((size, size), Image.LANCZOS).convert('RGB')

out = sys.argv[1]
render(192).save(f'{out}/pwa-192.png')
render(512).save(f'{out}/pwa-512.png')
render(512, 0.8).save(f'{out}/maskable-512.png')
render(180).save(f'{out}/apple-touch-icon-180.png')
