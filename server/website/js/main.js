// 星空粒子动画
const STAR_COLORS = [
    'rgba(255, 255, 255, ',
    'rgba(200, 220, 255, ',
    'rgba(255, 240, 200, ',
    'rgba(180, 200, 255, ',
    'rgba(255, 200, 220, ',
];

let particles = [];
const MAX_PARTICLES = 300;
const SPAWN_RATE = 10;
let animationFrameId = null;

function initStarCanvas() {
    const canvas = document.getElementById('star-canvas');
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    
    animateStarlight(canvas);
}

function createParticle(canvasWidth, canvasHeight) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const spawnRadius = Math.min(canvasWidth, canvasHeight) * 0.40;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnX = centerX + Math.cos(spawnAngle) * spawnRadius;
    const spawnY = centerY + Math.sin(spawnAngle) * spawnRadius;

    const edge = Math.floor(Math.random() * 4);
    let targetX, targetY;

    switch (edge) {
        case 0:
            targetX = Math.random() * canvasWidth;
            targetY = -50;
            break;
        case 1:
            targetX = canvasWidth + 50;
            targetY = Math.random() * canvasHeight;
            break;
        case 2:
            targetX = Math.random() * canvasWidth;
            targetY = canvasHeight + 50;
            break;
        default:
            targetX = -50;
            targetY = Math.random() * canvasHeight;
            break;
    }

    const dx = targetX - spawnX;
    const dy = targetY - spawnY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const isFast = Math.random() > 0.5;
    const isStar = Math.random() > 0.7;
    const speedMultiplier = isFast ? (0.5 + Math.random() * 0.6) : (0.1 + Math.random() * 0.3);
    const baseSpeed = (1.5 + Math.random() * 2) * speedMultiplier;

    return {
        x: spawnX,
        y: spawnY,
        z: 800 + Math.random() * 400,
        vx: (dx / dist) * baseSpeed,
        vy: (dy / dist) * baseSpeed,
        vz: -(2 + Math.random() * 4) * speedMultiplier,
        size: isStar ? (2 + Math.random() * 3) : (1 + Math.random() * 2),
        opacity: 0,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        life: 0,
        maxLife: isFast ? (60 + Math.random() * 80) : (150 + Math.random() * 150),
        isFast,
        isStar,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.03 + Math.random() * 0.05,
    };
}

function drawStar(ctx, cx, cy, outerRadius, innerRadius, opacity, color) {
    const spikes = 5;
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color + opacity + ')';
    ctx.fill();
}

function animateStarlight(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    function animate() {
        ctx.clearRect(0, 0, width, height);

        if (particles.length < MAX_PARTICLES) {
            for (let i = 0; i < SPAWN_RATE; i++) {
                if (particles.length < MAX_PARTICLES) {
                    particles.push(createParticle(width, height));
                }
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.life++;
            p.twinklePhase += p.twinkleSpeed;

            const fadeIn = Math.min(p.life / 50, 1);
            const fadeOut = Math.max(1 - (p.life - p.maxLife + 50) / 50, 0);
            const twinkle = p.isStar ? (0.7 + Math.sin(p.twinklePhase) * 0.3) : 1;
            p.opacity = fadeIn * fadeOut * twinkle;

            const scale = 800 / (800 + p.z);
            const screenX = (p.x - width / 2) * scale + width / 2;
            const screenY = (p.y - height / 2) * scale + height / 2;
            const screenSize = p.size * scale;

            if (p.isStar) {
                drawStar(ctx, screenX, screenY, screenSize, screenSize * 0.4, p.opacity, p.color);
            } else {
                ctx.beginPath();
                ctx.arc(screenX, screenY, screenSize, 0, Math.PI * 2);
                ctx.fillStyle = p.color + p.opacity + ')';
                ctx.fill();
            }

            if (p.life > p.maxLife || p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) {
                particles.splice(i, 1);
            }
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    animate();
}

// 导航栏滚动效果
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// 滚动显示动画
function initReveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    reveals.forEach(reveal => observer.observe(reveal));
}

// 平滑滚动
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initStarCanvas();
    initNavbar();
    initReveal();
    initSmoothScroll();
});

