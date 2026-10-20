from PIL import Image
big = Image.open('icon-1024.png').convert('RGBA'); small = Image.open('icon-small-256.png').convert('RGBA')
sizes = [256, 128, 64, 48, 32, 24, 16]
sheet = Image.new('RGBA', (sum(sizes) + 20 * len(sizes) + 20, 2 * 286), (0, 0, 0, 0))
for row, bg in enumerate([(24, 24, 30, 255), (238, 238, 242, 255)]):
    y = row * 286
    sheet.paste(Image.new('RGBA', (sheet.width, 286), bg), (0, y))
    x = 20
    for s in sizes:
        im = (big if s >= 48 else small).resize((s, s), Image.LANCZOS)
        sheet.alpha_composite(im, (x, y + 15 + (256 - s) // 2)); x += s + 20
sheet.save('preview-sheet.png')
