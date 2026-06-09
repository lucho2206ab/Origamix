# run once: python scripts/gen_icons.py
import struct, zlib, os

def create_png(filename, size, bg=(13,13,30), fg=(0,207,255)):
    """Create a minimal PNG with a triangle on dark background"""
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    # Create pixel data
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            # Draw a triangle shape
            cx, cy = size // 2, size // 2
            # Simple triangle: point up
            in_triangle = (
                y > size * 0.2 and
                y < size * 0.85 and
                abs(x - cx) < (y - size * 0.2) * 0.7
            )
            if in_triangle:
                row.extend(fg)
            else:
                row.extend(bg)
        pixels.append(bytes(row))
    
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    idat_data = b''.join(b'\x00' + row for row in pixels)
    compressed = zlib.compress(idat_data, 9)
    
    png = b'\x89PNG\r\n\x1a\n'
    png += make_chunk(b'IHDR', ihdr)
    png += make_chunk(b'IDAT', compressed)
    png += make_chunk(b'IEND', b'')
    
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Created {filename}")

create_png('public/icons/icon-192.png', 192)
create_png('public/icons/icon-512.png', 512)
