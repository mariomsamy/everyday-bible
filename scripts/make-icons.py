from PIL import Image, ImageDraw
import os
out = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'icons')
def icon(size, maskable=False):
    im = Image.new('RGB', (size, size), '#1f3a5f')
    d = ImageDraw.Draw(im)
    s = size * (0.6 if maskable else 0.74)
    x0 = (size - s) / 2; y0 = (size - s) / 2
    # open book
    w = s; h = s * 0.7
    top = y0 + (s - h) / 2
    gold = '#f2c46d'; page = '#fdf7e8'
    d.polygon([(x0, top + h*0.08), (x0 + w/2, top + h*0.18), (x0 + w/2, top + h), (x0, top + h*0.9)], fill=page)
    d.polygon([(x0 + w, top + h*0.08), (x0 + w/2, top + h*0.18), (x0 + w/2, top + h), (x0 + w, top + h*0.9)], fill='#efe3c4')
    # cross
    cx = x0 + w/2; t = w * 0.045
    d.rectangle([cx - t, top - h*0.28, cx + t, top + h*0.38], fill=gold)
    d.rectangle([cx - w*0.16, top - h*0.12, cx + w*0.16, top - h*0.12 + 2*t], fill=gold)
    return im
for n, sz, m in [('icon-192.png',192,False),('icon-512.png',512,False),('icon-maskable-512.png',512,True),('apple-touch-icon.png',180,False)]:
    icon(sz, m).save(os.path.join(out, n))
