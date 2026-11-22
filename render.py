
import os
import json
import urllib.request
import urllib.parse
import subprocess
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

API_URL = "https://motionstory-api.ane-you1111.workers.dev"
PROJECT_ID = os.environ["PROJECT_ID"]
API_TOKEN = os.environ["API_TOKEN"]

WORK = Path("render-work")
WORK.mkdir(exist_ok=True)

def api_get(path):
    req = urllib.request.Request(
        API_URL + path,
        headers={"Authorization": "Bearer " + API_TOKEN}
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read())

print("Mengambil data project...")
data = api_get(
    "/api/projects/" + urllib.parse.quote(PROJECT_ID, safe="") + "/scenes"
)

scenes = sorted(data.get("scenes", []), key=lambda x: x["scene_number"])

if not scenes:
    raise Exception("Project tidak memiliki adegan.")

if any(not s.get("image_url") for s in scenes):
    raise Exception("Ada adegan yang belum memiliki gambar.")

font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font = ImageFont.truetype(font_path, 68)
W, H = 1080, 1920
clip_files = []

def make_slide(scene, index):
    image_url = scene["image_url"]
    req = urllib.request.Request(
        image_url,
        headers={"User-Agent": "MOTIONSTORY-AI"}
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        image = Image.open(response).convert("RGB")

    # Potong gambar agar memenuhi format vertikal 9:16
    ratio = max(W / image.width, H / image.height)
    image = image.resize(
        (int(image.width * ratio), int(image.height * ratio)),
        Image.Resampling.LANCZOS
    )
    left = (image.width - W) // 2
    top = (image.height - H) // 2
    image = image.crop((left, top, left + W, top + H)).convert("RGBA")

    # Lapisan gelap di bagian bawah untuk keterbacaan teks
    gradient = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pixels = gradient.load()
    for y in range(850, H):
        alpha = int(205 * ((y - 850) / (H - 850)))
        for x in range(W):
            pixels[x, y] = (0, 0, 0, alpha)

    image = Image.alpha_composite(image, gradient)
    draw = ImageDraw.Draw(image)

    text = scene.get("narration") or scene.get("title") or "Tetaplah kuat."
    words = text.split()
    lines = []
    current = ""

    for word in words:
        test = (current + " " + word).strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= 900:
            current = test
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    if len(lines) > 7:
        smaller_font = ImageFont.truetype(font_path, 54)
        font_used = smaller_font
    else:
        font_used = font

    line_height = 95 if font_used == font else 76
    total_height = len(lines) * line_height
    y = H - total_height - 300

    for line in lines:
        draw.text(
            (90, y),
            line,
            font=font_used,
            fill="white",
            stroke_width=2,
            stroke_fill=(0, 0, 0, 180)
        )
        y += line_height

    output = WORK / f"slide-{index:02d}.png"
    image.convert("RGB").save(output, quality=95)
    return output

print("Menyiapkan gambar dan teks...")
for index, scene in enumerate(scenes, start=1):
    slide = make_slide(scene, index)
    duration = max(1, int(scene.get("duration") or 8))
    frames = duration * 30
    clip = WORK / f"clip-{index:02d}.mp4"

    print(f"Merender adegan {index}/{len(scenes)}...")

    subprocess.run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(slide),
        "-vf",
        f"zoompan=z='min(zoom+0.0005,1.04)':d={frames}:s=1080x1920:fps=30,"
        f"fade=t=in:st=0:d=0.4,"
        f"fade=t=out:st={max(0, duration-0.4)}:d=0.4,"
        "format=yuv420p",
        "-t", str(duration),
        "-an",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        str(clip)
    ], check=True)

    clip_files.append(clip)

print("Menggabungkan semua adegan...")

concat_file = WORK / "concat.txt"
with open(concat_file, "w") as f:
    for clip in clip_files:
        f.write(f"file '{clip.resolve()}'\n")

subprocess.run([
    "ffmpeg", "-y",
    "-f", "concat", "-safe", "0",
    "-i", str(concat_file),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-an",
    "-movflags", "+faststart",
    "motionstory-output.mp4"
], check=True)

print("BERHASIL: motionstory-output.mp4")
