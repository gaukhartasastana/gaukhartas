#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Настольная палатка с QR для банкетного зала «Гаухартас».

Формат A5 в сложенном виде (148×210 мм), печатается на A4 вдоль,
складывается пополам — получается двусторонняя палатка, которая
стоит на столе и читается с обеих сторон.

  python3 make_tent.py            → tent-print.pdf и превью
"""
import io, os
from urllib.parse import quote
import qrcode
from PIL import Image, ImageDraw, ImageFont

# ── ПАРАМЕТРЫ ────────────────────────────────────────────────────
PHONE = "77760077725"
CODE = "QR"                      # метка канала: видно в первом сообщении
# Кириллица при кодировании раздувается вдевятеро: длинная фраза давала
# QR 77×77, который камера не читала. Короткий текст — 53 модуля, читается
# уверенно даже с метра. Проверено декодером в трёх масштабах.
TEXT = "Свободные даты? [%s]" % CODE
URL = "https://wa.me/%s?text=%s" % (PHONE, quote(TEXT))

DPI = 300
MM = DPI / 25.4
A4_W, A4_H = int(297 * MM), int(210 * MM)   # альбомная, две половины по 148 мм
HALF = A4_W // 2

GOLD = (201, 164, 76)
GOLD_L = (230, 200, 127)
INK = (16, 13, 10)
CREAM = (245, 239, 227)
DIM = (150, 138, 116)

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")


def font(size, bold=False):
    """Ищем шрифт с кириллицей среди системных."""
    names = (["DejaVuSans-Bold.ttf", "NotoSans-Bold.ttf", "LiberationSans-Bold.ttf"]
             if bold else
             ["DejaVuSans.ttf", "NotoSans-Regular.ttf", "LiberationSans-Regular.ttf"])
    roots = ["/usr/share/fonts/truetype/dejavu/", "/usr/share/fonts/truetype/noto/",
             "/usr/share/fonts/truetype/liberation/", "/usr/share/fonts/"]
    for r in roots:
        for n in names:
            p = os.path.join(r, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    for r, _, fs in os.walk("/usr/share/fonts"):
        for f in fs:
            if f.endswith((".ttf", ".otf")):
                try:
                    return ImageFont.truetype(os.path.join(r, f), size)
                except Exception:
                    pass
    return ImageFont.load_default()


def make_qr(px):
    """Коррекция H — код читается с логотипом по центру и при царапинах."""
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,
                      box_size=20, border=4)   # тихая зона 4 модуля по стандарту
    q.add_data(URL)
    q.make(fit=True)
    img = q.make_image(fill_color=INK, back_color="white").convert("RGB")
    logo_path = os.path.join(ASSETS, "logo.webp")
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        w = int(img.size[0] * 0.18)
        logo = logo.resize((w, w), Image.LANCZOS)
        pad = Image.new("RGB", (w + 26, w + 26), "white")
        pad.paste(logo, (13, 13), logo)
        img.paste(pad, ((img.size[0] - pad.size[0]) // 2,) * 2)
    return img.resize((px, px), Image.LANCZOS)


def center(d, y, text, f, fill, w):
    tw = d.textbbox((0, 0), text, font=f)[2]
    d.text(((w - tw) // 2, y), text, font=f, fill=fill)
    return d.textbbox((0, 0), text, font=f)[3]


def ornament(d, cx, y, half_w):
    """Тонкая золотая линия с ромбом — тот же мотив, что на сайте."""
    d.line([(cx - half_w, y), (cx - 14, y)], fill=GOLD, width=2)
    d.line([(cx + 14, y), (cx + half_w, y)], fill=GOLD, width=2)
    d.polygon([(cx, y - 7), (cx + 7, y), (cx, y + 7), (cx - 7, y)], fill=GOLD)


def side(w, h, main=True):
    """Одна сторона палатки."""
    img = Image.new("RGB", (w, h), INK)
    d = ImageDraw.Draw(img)

    # рамка
    m = int(7 * MM)
    d.rectangle([m, m, w - m, h - m], outline=(58, 47, 32), width=2)
    m2 = m + int(3 * MM)
    d.rectangle([m2, m2, w - m2, h - m2], outline=(38, 31, 21), width=1)

    y = int(20 * MM)

    # логотип
    lp = os.path.join(ASSETS, "logo.webp")
    if os.path.exists(lp):
        lg = Image.open(lp).convert("RGBA")
        s = int(17 * MM)
        lg = lg.resize((s, s), Image.LANCZOS)
        img.paste(lg, ((w - s) // 2, y), lg)
        y += s + int(6 * MM)

    center(d, y, "ГАУХАРТАС", font(int(5.4 * MM), True), CREAM, w)
    y += int(9 * MM)
    center(d, y, "Б А Н К Е Т   З А Л Ы   ·   А С Т А Н А",
           font(int(2.5 * MM)), GOLD, w)
    y += int(9 * MM)

    ornament(d, w // 2, y, int(26 * MM))
    y += int(10 * MM)

    if main:
        center(d, y, "Понравился вечер?", font(int(6.2 * MM), True), CREAM, w)
        y += int(11 * MM)
        center(d, y, "Забронируйте свою дату", font(int(4.6 * MM)), GOLD_L, w)
        y += int(12 * MM)
    else:
        center(d, y, "Той өткізгіңіз келе ме?", font(int(5.6 * MM), True), CREAM, w)
        y += int(10 * MM)
        center(d, y, "Күніңізді брондаңыз", font(int(4.4 * MM)), GOLD_L, w)
        y += int(12 * MM)

    # QR на белой подложке — на тёмном фоне камера читает хуже
    qs = int(46 * MM)
    pad = int(4 * MM)
    plate = Image.new("RGB", (qs + pad * 2, qs + pad * 2), "white")
    plate.paste(make_qr(qs), (pad, pad))
    img.paste(plate, ((w - plate.size[0]) // 2, y))
    y += plate.size[1] + int(7 * MM)

    center(d, y, "Наведите камеру телефона" if main else "Телефон камерасын бағыттаңыз",
           font(int(3.1 * MM)), DIM, w)
    y += int(7 * MM)
    center(d, y, "+7 776 007 77 25", font(int(5.2 * MM), True), GOLD_L, w)
    y += int(9 * MM)
    center(d, y, "ул. Ермека Серкебаева, 11" if main else "Ермек Серкебаев к-сі, 11",
           font(int(2.9 * MM)), DIM, w)
    y += int(5 * MM)
    center(d, y, "Отдел продаж 11:00 — 21:00" if main else "Сату бөлімі 11:00 — 21:00",
           font(int(2.9 * MM)), DIM, w)

    return img


def build():
    sheet = Image.new("RGB", (A4_W, A4_H), "white")
    # левая половина перевёрнута: после сгиба обе стороны читаются правильно
    sheet.paste(side(HALF, A4_H, main=False).rotate(180), (0, 0))
    sheet.paste(side(HALF, A4_H, main=True), (HALF, 0))

    d = ImageDraw.Draw(sheet)
    for y in range(0, A4_H, 26):          # пунктир линии сгиба
        d.line([(HALF, y), (HALF, y + 13)], fill=(205, 205, 205), width=1)

    sheet.save(os.path.join(HERE, "tent-print.pdf"), "PDF", resolution=DPI)
    sheet.resize((A4_W // 3, A4_H // 3), Image.LANCZOS).save(
        os.path.join(HERE, "tent-preview.png"))
    make_qr(1200).save(os.path.join(HERE, "qr-only.png"))
    print("tent-print.pdf   — A4, печать и сгиб пополам")
    print("tent-preview.png — как выглядит")
    print("qr-only.png      — только QR, для наклеек и визиток")
    print("\nссылка в коде:", URL)


if __name__ == "__main__":
    build()
