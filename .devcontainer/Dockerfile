# Menggunakan mesin dasar Node 18 dari Microsoft
FROM mcr.microsoft.com/devcontainers/javascript-node:18

# Mematikan semua prompt interaktif dari Ubuntu
ENV DEBIAN_FRONTEND=noninteractive

# Menginstal paket grafis (Termasuk rahasia OSMesa Anda) secara diam-diam
RUN apt-get update && apt-get install -yq \
    xvfb \
    libgl1 \
    libglx-mesa0 \
    libosmesa6 \
    libgbm-dev \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
