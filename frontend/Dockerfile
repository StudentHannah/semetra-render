# kleiner, schneller Webserver
FROM nginx:alpine

# optional: eigene nginx config (siehe Schritt 1.2)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# deine statische Seite in den nginx webroot kopieren
COPY ./dist/levis-progress-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf


# Port, auf dem nginx im Container lauscht
EXPOSE 80
