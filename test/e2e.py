import os, sys, time, subprocess, base64
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "test", "shots"); os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", os.path.join(ROOT, "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors = []
def snap(pg, name):
    png = pg.evaluate("() => document.querySelector('[data-testid=stage]').toDataURL('image/jpeg',0.7)")
    open(os.path.join(OUT, f"{name}.jpg"), "wb").write(base64.b64decode(png.split(",")[1]))
def ink(pg):
    return pg.evaluate("""() => { const c=document.querySelector('[data-testid=stage]'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; const set=new Set(); for(let i=0;i<d.length;i+=4*89){ set.add((d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4)); } return set.size; }""")
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(viewport={"width": 420, "height": 900})
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        pg.goto("http://localhost:8765/index.html"); pg.wait_for_selector("[data-testid=stage]")
        print("1 page loads")
        pg.set_input_files("[data-testid=file-input]", os.path.join(ROOT, "test", "photo.jpg")); pg.wait_for_timeout(500)
        assert pg.locator(".dropzone").count() == 0
        print("2 photo upload accepted")
        # gallery thumbnails rendered
        n = pg.locator(".thumb canvas").count(); assert n == 27, n
        blank = pg.evaluate("""() => [...document.querySelectorAll('.thumb canvas')].filter(c => { const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let s=0; for(let i=0;i<d.length;i+=4*13) s+=d[i]+d[i+1]+d[i+2]; return s===0; }).length""")
        assert blank == 0, f"{blank} blank thumbnails"
        pg.screenshot(path=os.path.join(OUT, "gallery.png"), full_page=True)
        print("3 all 27 thumbnails render")
        # every template on the main stage, at end of animation
        pg.click("text=Look"); pg.click("text=Animate")  # turn off animate for deterministic captures
        pg.click("text=Style")
        ids = pg.evaluate("() => [...document.querySelectorAll('[data-testid^=tpl-]')].map(e=>e.dataset.testid)")
        for t in ids:
            pg.click(f"[data-testid={t}]"); pg.wait_for_timeout(120)
            assert ink(pg) > 15, f"{t} drew nothing"
            snap(pg, t)
        print("4 all templates render on stage")
        # formats
        for fmt, hh in [("4:5", 1350), ("1:1", 1080), ("9:16", 1920)]:
            pg.click(f".preview .seg >> text={fmt}"); pg.wait_for_timeout(150)
            dims = pg.evaluate("() => { const c=document.querySelector('[data-testid=stage]'); return [c.width,c.height]; }")
            assert dims == [1080, hh], (fmt, dims)
            if fmt == "1:1":
                for t in ["tpl-receipt", "tpl-rings", "tpl-orbit", "tpl-splits"]:
                    pg.click(f"[data-testid={t}]"); pg.wait_for_timeout(100); snap(pg, f"square-{t}")
        print("5 formats switch canvas size")
        # workout demo + health templates
        pg.click("text=Stats"); pg.click("[data-testid=demo-workout]"); pg.click("text=Style")
        for t in ["tpl-hrwave", "tpl-zones", "tpl-rings", "tpl-sticker", "tpl-receipt"]:
            pg.click(f"[data-testid={t}]"); pg.wait_for_timeout(120); assert ink(pg) > 15; snap(pg, f"workout-{t}")
        pg.click("text=Stats"); pg.click("text=Demo run")
        print("6 workout mode renders health templates")
        # manual edit
        pg.click("[data-testid=edit-stats]"); pg.fill(".span2 input", ""); pg.type(".span2 input", "Test run", delay=15)
        assert pg.input_value(".span2 input") == "Test run"
        pg.locator(".hms input").nth(1).fill("47"); pg.wait_for_timeout(100)
        assert "1:47:15" in pg.locator(".card").first.inner_text()
        pg.select_option("select", "ride"); pg.wait_for_timeout(100)
        assert "km/h" in pg.locator(".card").first.inner_text(), pg.locator(".card").first.inner_text()
        pg.select_option("select", "run")
        print("7 manual stats edit works (incl. sport switch)")
        # caption copy
        pg.context.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://localhost:8765")
        pg.click("[data-testid=copy-caption]"); pg.wait_for_timeout(200)
        clip = pg.evaluate("() => navigator.clipboard.readText()")
        assert "Test run" in clip and "#running" in clip, clip
        print("8 caption copies:", clip.splitlines()[1])
        # exports: image, sticker, animated video from a photo
        pg.click("text=Style"); pg.click("[data-testid=tpl-neon]")
        pg.click("[data-testid=export-image]"); pg.wait_for_selector("[data-testid=result-image]")
        dims = pg.evaluate("() => { const i=document.querySelector('[data-testid=result-image]'); return [i.naturalWidth,i.naturalHeight]; }")
        assert dims == [1080, 1920], dims
        pg.screenshot(path=os.path.join(OUT, "export-modal.png")); pg.click("text=Close")
        pg.click("[data-testid=export-sticker]"); pg.wait_for_selector("[data-testid=result-image]")
        alpha0 = pg.evaluate("""async () => { const i=document.querySelector('[data-testid=result-image]'); await i.decode(); const c=document.createElement('canvas'); c.width=i.naturalWidth; c.height=i.naturalHeight; const x=c.getContext('2d'); x.drawImage(i,0,0); return x.getImageData(5,5,1,1).data[3]; }""")
        assert alpha0 == 0, f"sticker corner not transparent ({alpha0})"
        pg.click("text=Close")
        print("9 image + transparent sticker export")
        pg.click("text=Look"); pg.click("text=Animate"); pg.click("text=Style")  # animate back on
        pg.click("[data-testid=tpl-chase]")
        pg.click("[data-testid=export-video]"); pg.wait_for_selector("[data-testid=result-video]", timeout=30000); pg.wait_for_timeout(1200)
        info = pg.evaluate("""async () => { const v=document.querySelector('[data-testid=result-video]'); const r=await fetch(v.src); const b=await r.blob(); return [b.size, b.type, v.duration]; }""")
        assert info[0] > 50000 and info[2] > 5, info
        print("10 animated video from photo:", info)
        pg.click("text=Close")
        # design controls: fonts, text colour, tagline, hide meta, drag, backgrounds, saved looks
        pg.click("text=Look"); pg.click("text=Animate"); pg.click("text=Style"); pg.click("[data-testid=tpl-sticker]"); pg.wait_for_timeout(150)
        base = pg.evaluate("() => document.querySelector('[data-testid=stage]').toDataURL('image/jpeg',0.5)")
        pg.click("text=Text"); pg.click("[data-testid=hero-cond]"); pg.wait_for_timeout(150)
        f1 = pg.evaluate("() => document.querySelector('[data-testid=stage]').toDataURL('image/jpeg',0.5)"); assert f1 != base, "hero font change had no effect"
        pg.click(".swatch[title='Volt']"); pg.wait_for_timeout(120)
        f2 = pg.evaluate("() => document.querySelector('[data-testid=stage]').toDataURL('image/jpeg',0.5)"); assert f2 != f1, "text colour had no effect"
        pg.fill("[data-testid=tagline]", "First half marathon!"); pg.wait_for_timeout(150)
        f3 = pg.evaluate("() => document.querySelector('[data-testid=stage]').toDataURL('image/jpeg',0.5)"); assert f3 != f2, "tagline not drawn"
        pg.click("[data-testid=show-meta]"); pg.wait_for_timeout(120)
        f4 = pg.evaluate("() => document.querySelector('[data-testid=stage]').toDataURL('image/jpeg',0.5)"); assert f4 != f3, "hide meta had no effect"
        snap(pg, "design-controls")
        # drag on preview moves the design
        pg.evaluate("() => window.scrollTo(0,0)"); pg.wait_for_timeout(100)
        box = pg.locator("[data-testid=stage]").bounding_box()
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); pg.mouse.down()
        pg.mouse.move(box["x"] + box["width"] / 2 + 40, box["y"] + box["height"] / 2 - 60, steps=5); pg.mouse.up(); pg.wait_for_timeout(150)
        pg.click("text=Adjust")
        vals = pg.evaluate("() => [...document.querySelectorAll('input[type=range]')].map(i => i.value)")
        assert int(vals[1]) > 0 and int(vals[2]) < 0, f"drag did not update offsets: {vals}"
        # saved look round-trip
        pg.fill("[data-testid=look-name]", "Volt night"); pg.click("[data-testid=save-look]"); pg.wait_for_timeout(200)
        assert pg.locator("[data-testid='look-Volt night']").count() == 1
        pg.click("text=Text"); pg.click("[data-testid=hero-sans]"); pg.click(".swatch.auto"); pg.click("text=Adjust")
        pg.click("[data-testid='look-Volt night']"); pg.wait_for_timeout(150)
        assert pg.evaluate("() => JSON.parse(localStorage.getItem('stride.looks')).length") == 1
        pg.click("text=Text"); assert pg.locator("[data-testid=hero-cond].on").count() == 1, "applying look did not restore hero font"
        pg.fill("[data-testid=tagline]", "")
        print("13 fonts, colour, tagline, toggles, drag and saved looks work")
        # no-photo background export
        pg.reload(); pg.wait_for_selector("[data-testid=stage]")
        pg.click("text=Look"); pg.click("[data-testid=bg-sunrise]"); pg.wait_for_timeout(200); snap(pg, "nophoto-sunrise")
        pg.click("[data-testid=export-image]"); pg.wait_for_selector("[data-testid=result-image]"); pg.click("text=Close")
        pg.set_input_files("[data-testid=file-input]", os.path.join(ROOT, "test", "photo.jpg")); pg.wait_for_timeout(500)
        print("14 no-photo gradient background + export")
        # strava bad token
        pg.click("text=Connect Strava"); pg.fill("[data-testid=token-input]", "bad"); pg.click(".modal >> text=Load")
        pg.wait_for_selector("[data-testid=strava-status]"); pg.wait_for_timeout(2000)
        print("11 strava status:", pg.inner_text("[data-testid=strava-status]")); pg.click("text=Use demo run instead")
        # video clip
        pg.set_input_files("[data-testid=file-input-2]", os.path.join(ROOT, "test", "clip.webm"))
        pg.wait_for_timeout(1200); snap(pg, "video-hud")
        pg.click("[data-testid=export-video]"); pg.wait_for_selector("[data-testid=result-video]", timeout=30000); pg.wait_for_timeout(1200)
        info = pg.evaluate("""async () => { const v=document.querySelector('[data-testid=result-video]'); const r=await fetch(v.src); const b=await r.blob(); return [b.size, b.type, v.duration]; }""")
        assert info[0] > 20000, info
        print("12 video clip export:", info)
        b.close()
finally: srv.terminate()
real = [e for e in errors if "strava.com" not in e and "ERR_FAILED" not in e]
print("console errors:", real)
print("ALL PASSED" if not real else "FAILED: console errors")
