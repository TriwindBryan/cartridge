import asyncio, sys, pathlib
from playwright.async_api import async_playwright
here = pathlib.Path(sys.argv[1])
async def shot(pg, svg, out, size):
    page = svg.with_suffix('.render.html')
    page.write_text(f"<html><body style='margin:0;background:transparent'><img src='{svg.name}' style='width:{size}px;height:{size}px;object-fit:contain;display:block'></body></html>")
    await pg.set_viewport_size({'width': size, 'height': size})
    await pg.goto(page.as_uri()); await pg.wait_for_timeout(300)
    await pg.screenshot(path=str(out), omit_background=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await shot(pg, here/'cartridge-icon.svg', here/'icon-1024.png', 1024)
        await shot(pg, here/'cartridge-icon-small.svg', here/'icon-small-256.png', 256)
        await b.close()
    for f in here.glob('*.render.html'): f.unlink()
asyncio.run(main())
