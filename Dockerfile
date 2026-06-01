# ─── Base ────────────────────────────────────────────────────────────────────
FROM php:8.2-cli

ENV DEBIAN_FRONTEND=noninteractive

# ─── System deps + LibreOffice Impress (for PPTX → PDF headless conversion) ──
RUN apt-get update && apt-get install -y --no-install-recommends \
        # PHP extension deps
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libpq-dev \
        # LibreOffice Impress — headless PPTX → PDF conversion
        libreoffice-impress \
        libreoffice-writer \
        # Fonts — critical for PPTX layout fidelity
        fonts-liberation \
        fonts-noto-core \
        # Utilities
        curl \
        git \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# ─── PHP extensions ───────────────────────────────────────────────────────────
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" gd zip pdo pdo_pgsql

# ─── Node.js 20 ───────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ─── Composer ─────────────────────────────────────────────────────────────────
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# ─── App ──────────────────────────────────────────────────────────────────────
WORKDIR /app
COPY . .

RUN composer install --no-dev --optimize-autoloader

RUN npm ci && npm run build

# ─── Entrypoint ───────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
