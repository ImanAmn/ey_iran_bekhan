const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');

const PORT = process.env.PORT || 10000;

// ایجاد سرور HTTP ساده برای رندر
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Tunnel is Active and Running!');
});

// راه‌اندازی سرور وب‌ساکت روی مسیر /tunnel
const wss = new WebSocketServer({ server, path: '/tunnel' });

wss.on('connection', (ws) => {
    let tcpSocket = null;

    ws.on('message', (message) => {
        // اگر اولین پکت بیاید، ارتباط TCP را با مقصد برقرار می‌کنیم
        if (!tcpSocket) {
            // پکت‌های اولیه تروجان/VLESS شامل آدرس و پورت مقصد هستند
            // برای سادگی و هماهنگی با کلاینت، دیتا را مستقیم تانل می‌کنیم
            // در اینجا فرض بر این است که کلاینت پکت استاندارد تروجان می‌فرستد
            
            // ما دیتای خام را به یک پراکسی ملوانی یا مستقیم فوروارد می‌کنیم
            // اما برای اینکه با هسته Xray ست شود، پکت تروجان را دیکود می‌کنیم:
            try {
                // ساختار ساده برای ریلی کردن پکت‌ها به اینترنت آزاد
                // در کلاینت (نکورای) این را به عنوان سرفیس تروجان معرفی می‌کنیم
                tcpSocket = new net.Socket();
                
                // پورت استاندارد تروجان وب‌ساکت معمولاً مستقیم به مقصد وصل می‌شود
                // برای این کار، پکت حاوی تارگت را پارس می‌کنیم
                const port = (message[17] << 8) | message[18];
                let address = '';
                if (message[19] === 1) { // IPv4
                    address = message.slice(20, 24).join('.');
                } else if (message[19] === 2) { // Domain
                    const len = message[20];
                    address = message.slice(21, 21 + len).toString();
                }

                tcpSocket.connect(port, address, () => {
                    // ارسال مابقی دیتا بعد از هدر
                    const headerLen = message[19] === 1 ? 24 : 21 + message[20];
                    if (message.length > headerLen) {
                        tcpSocket.write(message.slice(headerLen));
                    }
                });

                tcpSocket.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) ws.send(data);
                });

                tcpSocket.on('close', () => ws.close());
                tcpSocket.on('error', () => ws.close());
            } catch (e) {
                ws.close();
            }
        } else {
            if (tcpSocket.writable) tcpSocket.write(message);
        }
    });

    ws.on('close', () => {
        if (tcpSocket) tcpSocket.destroy();
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
