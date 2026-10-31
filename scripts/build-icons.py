#!/usr/bin/env python3
"""由 design/mascot-1024.png 產生 App 圖示（手機桌面、首頁用）。
用法：python3 scripts/build-icons.py      （需要 Pillow、numpy、scipy；換圖後執行一次，再把 sw.js、js/app.js、index.html 的版本號 +1）

產出：
  icons/icon-512.png、icon-192.png      一般用途：圓角、四角透明
  icons/icon-maskable-512.png           Android 自適應圖示：內縮並補底色，確保重要內容在安全區內
  icons/apple-touch-icon.png (180)      iOS：滿版方形（iOS 自己會裁圓角），不能有透明
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(root, 'design/mascot-1024.png')).convert('RGB')
a = np.array(src)
BG = (253, 198, 114)

# 圖外四角的白色（圓角外側）→ 透明
white = a.min(axis=2) > 238
lab, _ = ndi.label(white)
outside = np.zeros(white.shape, bool)
for y, x in [(0, 0), (0, 1023), (1023, 0), (1023, 1023)]:
    if white[y, x]: outside |= lab == lab[y, x]
outside = ndi.binary_dilation(outside, iterations=2)
rgba = np.dstack([a, np.where(outside, 0, 255).astype(np.uint8)])
rounded = Image.fromarray(rgba, 'RGBA')

def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(root, 'icons', name), optimize=True)
    print('寫入', name, size)

save(rounded, 'icon-512.png', 512)
save(rounded, 'icon-192.png', 192)

# 滿版方形：往內裁掉圓角（裁 60px，已驗證四角沒有白色殘留）
m = 60
full = src.crop((m, m, 1024 - m, 1024 - m))
save(full, 'apple-touch-icon.png', 180)

# maskable：滿版方形再縮小到 80%，四周補底色（安全區 = 中央 80%）
pad = Image.new('RGB', (1024, 1024), BG)
inner = full.resize((819, 819), Image.LANCZOS)
pad.paste(inner, ((1024 - 819) // 2, (1024 - 819) // 2))
save(pad, 'icon-maskable-512.png', 512)
