#!/bin/bash
cat << 'EOF' > /etc/nginx/sites-available/nodecommander
server {
    listen 80;
    server_name nodecommander.azespo.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nodecommander /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx
certbot --nginx -d nodecommander.azespo.com.br --non-interactive --agree-tos -m jorge.azevedo.98@gmail.com
