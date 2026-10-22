import zlib
import struct
import math
import os

def create_png(width, height, draw_func, filename):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([r, g, b, a])
            
    # PNG signature
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png.extend(struct.pack('>I', len(ihdr_data)))
    png.extend(b'IHDR')
    png.extend(ihdr_data)
    png.extend(struct.pack('>I', ihdr_crc))
    
    # IDAT chunk
    compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png.extend(struct.pack('>I', len(compressed)))
    png.extend(b'IDAT')
    png.extend(compressed)
    png.extend(struct.pack('>I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('>I', iend_crc))
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename}")

def draw_icon(x, y, w, h, is_maskable=False):
    # Normalized coordinates 0.0 to 1.0
    nx = x / float(w)
    ny = y / float(h)
    
    # Base blue gradient
    # Top left: #2563eb (37, 99, 235), Bottom right: #1d4ed8 (29, 78, 216)
    t = (nx + ny) / 2.0
    br = int(37 * (1 - t) + 29 * t)
    bg = int(99 * (1 - t) + 78 * t)
    bb = int(235 * (1 - t) + 216 * t)
    
    if not is_maskable:
        # Round corners (radius ~ 25% of size)
        rx = min(nx, 1.0 - nx)
        ry = min(ny, 1.0 - ny)
        corner_r = 0.22
        if rx < corner_r and ry < corner_r:
            dx = corner_r - rx
            dy = corner_r - ry
            if math.sqrt(dx*dx + dy*dy) > corner_r:
                return (0, 0, 0, 0) # transparent
    
    # Content area (safe zone padding if maskable)
    pad = 0.16 if is_maskable else 0.0
    cx = (nx - pad) / (1.0 - 2.0 * pad)
    cy = (ny - pad) / (1.0 - 2.0 * pad)
    
    if 0.0 <= cx <= 1.0 and 0.0 <= cy <= 1.0:
        # Stack bars
        # Bar 1 (Top): cy between 0.32 and 0.42, cx between 0.25 and 0.75
        if 0.25 <= cx <= 0.75:
            # Bar 1
            if 0.32 <= cy <= 0.42:
                # White bar
                # Circle checkbox inside bar: center cx=0.33, cy=0.37, r=0.03
                dx = cx - 0.33
                dy = cy - 0.37
                if dx*dx + dy*dy <= 0.032*0.032:
                    return (37, 99, 235, 255) # blue check circle
                # Bar fill
                return (255, 255, 255, 255)
            # Bar 2 (Middle)
            elif 0.47 <= cy <= 0.56:
                return (255, 255, 255, 200)
            # Bar 3 (Bottom)
            elif 0.61 <= cy <= 0.70:
                return (255, 255, 255, 130)
                
    return (br, bg, bb, 255)

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pub = os.path.join(base_dir, 'public')
    create_png(192, 192, lambda x, y, w, h: draw_icon(x, y, w, h, False), os.path.join(pub, 'pwa-192x192.png'))
    create_png(512, 512, lambda x, y, w, h: draw_icon(x, y, w, h, False), os.path.join(pub, 'pwa-512x512.png'))
    create_png(512, 512, lambda x, y, w, h: draw_icon(x, y, w, h, True), os.path.join(pub, 'pwa-maskable-512x512.png'))
    create_png(180, 180, lambda x, y, w, h: draw_icon(x, y, w, h, False), os.path.join(pub, 'apple-touch-icon.png'))
    create_png(64, 64, lambda x, y, w, h: draw_icon(x, y, w, h, False), os.path.join(pub, 'favicon.ico'))
