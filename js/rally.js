/* The rally: an interactive side-view tennis rally on a canvas.
 *
 * Left racket is yours. Move the mouse to place it; the ball comes off the
 * strings the moment they touch, and how fast you are moving sets the depth
 * and pace of the shot. On touch, the racket tracks the ball on its own and
 * a tap swings. The far racket is the opponent: it chases the ball at a
 * fixed top speed, so a well-placed shot gets past it.
 *
 * When nobody is playing, both rackets are driven by the same opponent
 * logic, so the hero always has a rally going.
 */
(function () {
    var root = document.getElementById("rally");
    var canvas = document.getElementById("rally-canvas");
    if (!root || !canvas || !canvas.getContext) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ctx = canvas.getContext("2d");
    var scoreEl = document.getElementById("rally-score");
    var msgEl = document.getElementById("rally-msg");
    var hintEl = document.getElementById("rally-hint");

    // ---- Palette from CSS custom properties --------------------------------
    var css = getComputedStyle(document.documentElement);
    function v(name, fallback) {
        var val = css.getPropertyValue(name).trim();
        return val || fallback;
    }
    var COLORS = {
        ink: v("--text-color", "#1a1a1a"),
        ball: v("--ball", "#D9F441"),
        ballDeep: v("--ball-deep", "#A9C41E"),
        ballLight: "#EAFF6B",
        glow: "rgba(217, 244, 65, "
    };

    // ---- Geometry (all in CSS pixels, recomputed on resize) ----------------
    var W = 0, H = 0, dpr = 1;
    var G = {};          // derived measurements
    function layout() {
        var rect = root.getBoundingClientRect();
        W = Math.max(1, Math.round(rect.width));
        H = Math.max(1, Math.round(rect.height));
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        G.floor = H * 0.80;
        G.netX = W * 0.5;
        G.netH = H * 0.17;
        G.ballR = Math.max(8, W * 0.027);
        G.headR = Math.max(18, W * 0.058);
        G.gravity = H * 2.1;           // px/s^2
        G.leftHomeX = W * 0.14;
        G.rightHomeX = W * 0.86;
        G.homeY = G.floor - H * 0.22;
        G.minY = H * 0.08;
        G.maxY = G.floor - G.headR * 0.4;
    }

    // ---- State -------------------------------------------------------------
    var ball = { x: 0, y: 0, vx: 0, vy: 0, spin: 0, spinV: 8, alive: false, bounces: 0, side: 1, squash: 0 };
    var left = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, swing: 0, dir: 1, ai: true };
    var right = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, swing: 0, dir: -1, ai: true };
    var trail = [];
    var bursts = [];
    var rally = 0, best = 0;
    var mode = "auto";           // auto | mouse | touch
    var lastInput = 0;
    var serveTimer = 0;
    var serveFrom = -1;          // which side serves next: -1 right, 1 left
    var msgTimer = 0;
    var pointer = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, t: 0 };
    var hitCooldown = 0;

    function reset() {
        layout();
        left.x = left.tx = G.leftHomeX;  left.y = left.ty = G.homeY;
        right.x = right.tx = G.rightHomeX; right.y = right.ty = G.homeY;
        ball.alive = false;
        serveTimer = 0.4;
        serveFrom = -1;
        trail.length = 0;
    }

    // ---- Shots -------------------------------------------------------------
    // Launch the ball from (x0, y0) so it lands at landX in T seconds,
    // raising the arc until it clears the net with room to spare.
    function launch(x0, y0, landX, T) {
        for (var i = 0; i < 12; i++) {
            var vx = (landX - x0) / T;
            var vy = (G.floor - G.ballR - y0 - 0.5 * G.gravity * T * T) / T;
            var tNet = (G.netX - x0) / vx;
            var yNet = y0 + vy * tNet + 0.5 * G.gravity * tNet * tNet;
            var clearance = G.floor - G.netH - G.ballR - H * 0.03;
            if (tNet <= 0 || yNet < clearance) {
                ball.vx = vx; ball.vy = vy;
                return;
            }
            T += 0.12;
        }
        ball.vx = (landX - x0) / T;
        ball.vy = (G.floor - G.ballR - y0 - 0.5 * G.gravity * T * T) / T;
    }

    function hit(racket, power) {
        // power 0..1: harder swings go deeper and flatter
        power = Math.max(0, Math.min(1, power));
        var toRight = racket === left;
        var depth = 0.16 + 0.30 * power + (Math.random() - 0.5) * 0.08;
        var landX = toRight ? G.netX + depth * W : G.netX - depth * W;
        landX = Math.max(W * 0.06, Math.min(W * 0.94, landX));
        var T = 1.55 - 0.55 * power;
        launch(ball.x, ball.y, landX, T);
        ball.spinV = (toRight ? 1 : -1) * (10 + 14 * power);
        ball.bounces = 0;
        ball.side = toRight ? 1 : -1;
        ball.squash = 1;
        racket.swing = 1;
        hitCooldown = 0.25;
        rally++;
        if (rally > best) best = rally;
        bursts.push({ x: ball.x, y: ball.y, t: 0 });
        updateScore();
    }

    function serve() {
        var from = serveFrom === 1 ? left : right;
        ball.x = from.x + (serveFrom === 1 ? 1 : -1) * G.headR * 0.6;
        ball.y = from.y - G.headR * 0.2;
        ball.alive = true;
        ball.bounces = 0;
        trail.length = 0;
        rally = 0;
        hit(from, 0.35 + Math.random() * 0.3);
        rally = 0;          // the serve doesn't count
        updateScore();
    }

    function pointOver(text, winnerIsPlayer) {
        ball.alive = false;
        serveTimer = 1.1;
        serveFrom = -serveFrom;
        if (mode !== "auto" && text) flash(text, winnerIsPlayer);
        rally = 0;
        updateScore();
    }

    // ---- Opponent logic ----------------------------------------------------
    function driveAI(r, dt, speedScale) {
        var incoming = ball.alive && ((r === right && ball.vx > 0) || (r === left && ball.vx < 0));
        var homeX = r === left ? G.leftHomeX : G.rightHomeX;
        if (incoming) {
            // Predict where the ball crosses the racket's x, bounce included
            var t = (homeX - ball.x) / ball.vx;
            var py = ball.y + ball.vy * t + 0.5 * G.gravity * t * t;
            if (py > G.floor - G.ballR) {
                // it bounces first: reflect the overshoot (rough but convincing)
                py = G.floor - G.ballR - (py - (G.floor - G.ballR)) * 0.7;
            }
            r.tx = homeX + (ball.x > homeX ? (r === right ? G.headR : -G.headR) : 0);
            r.ty = Math.max(G.minY, Math.min(G.maxY, py));
        } else {
            r.tx = homeX;
            r.ty = G.homeY;
        }
        var maxV = (H * 0.95) * speedScale;
        var dx = r.tx - r.x, dy = r.ty - r.y;
        var dist = Math.hypot(dx, dy);
        var step = Math.min(dist, maxV * dt);
        if (dist > 0.5) {
            r.x += dx / dist * step;
            r.y += dy / dist * step;
        }
    }

    // ---- Player control ----------------------------------------------------
    function drivePlayer(dt) {
        if (mode === "mouse") {
            left.tx = Math.max(G.headR * 0.6, Math.min(G.netX - G.headR * 1.4, pointer.x));
            left.ty = Math.max(G.minY, Math.min(G.maxY, pointer.y));
            var k = 1 - Math.pow(0.0005, dt);      // quick, slightly soft follow
            var nx = left.x + (left.tx - left.x) * k;
            var ny = left.y + (left.ty - left.y) * k;
            left.vx = (nx - left.x) / dt;
            left.vy = (ny - left.y) / dt;
            left.x = nx; left.y = ny;
        } else if (mode === "touch") {
            // Racket rides the ball's height; the tap does the swinging
            driveAI(left, dt, 1.4);
        }
    }

    function racketReach(r) {
        return Math.hypot(ball.x - r.x, ball.y - r.y) < G.headR + G.ballR;
    }

    // ---- Simulation --------------------------------------------------------
    function step(dt) {
        var now = performance.now();
        if (mode !== "auto" && now - lastInput > (mode === "touch" ? 9000 : 6000)) {
            setMode("auto");
        }

        if (hitCooldown > 0) hitCooldown -= dt;
        if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) msgEl.classList.remove("show"); }

        // Rackets
        if (mode === "auto") driveAI(left, dt, 1.0); else drivePlayer(dt);
        driveAI(right, dt, mode === "auto" ? 1.0 : 0.78);
        left.swing = Math.max(0, left.swing - dt * 4.5);
        right.swing = Math.max(0, right.swing - dt * 4.5);

        // Serve timer
        if (!ball.alive) {
            serveTimer -= dt;
            if (serveTimer <= 0) serve();
            return;
        }

        // Ball flight
        ball.vy += G.gravity * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.spin += ball.spinV * dt;
        ball.squash = Math.max(0, ball.squash - dt * 6);

        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 9) trail.shift();

        // Floor bounce
        if (ball.y > G.floor - G.ballR && ball.vy > 0) {
            ball.y = G.floor - G.ballR;
            ball.vy = -ball.vy * 0.72;
            ball.vx *= 0.88;
            ball.spinV *= 0.8;
            ball.squash = 1;
            ball.bounces++;
            if (ball.bounces >= 2) {
                var playerSide = ball.x < G.netX;
                pointOver(playerSide ? "Missed it" : "Point!", !playerSide);
                return;
            }
        }

        // Net
        var prevX = ball.x - ball.vx * dt;
        if ((prevX - G.netX) * (ball.x - G.netX) <= 0 && ball.y > G.floor - G.netH - G.ballR * 0.3) {
            ball.x = G.netX - Math.sign(ball.vx) * G.ballR;
            ball.vx = -ball.vx * 0.25;
            ball.vy = Math.min(ball.vy, 0) * 0.3;
            ball.bounces = 1;
            bursts.push({ x: ball.x, y: ball.y, t: 0, small: true });
        }

        // Out past either end
        if (ball.x < -G.ballR * 3) { pointOver("Missed it", false); return; }
        if (ball.x > W + G.ballR * 3) { pointOver("Point!", true); return; }

        // Contact
        if (hitCooldown <= 0) {
            if (ball.vx < 0 && racketReach(left)) {
                if (mode === "mouse") {
                    var speed = Math.hypot(left.vx, left.vy);
                    hit(left, speed / (H * 1.6));
                } else if (mode === "auto") {
                    hit(left, 0.3 + Math.random() * 0.45);
                }
                // touch mode waits for a tap (see swing())
            } else if (ball.vx > 0 && racketReach(right)) {
                hit(right, mode === "auto" ? 0.3 + Math.random() * 0.45 : 0.25 + Math.random() * 0.55);
            }
        }
    }

    function swing() {
        // Touch: swing now. Generous window so it feels fair on a phone.
        if (!ball.alive || ball.vx >= 0) { left.swing = 1; return; }
        var d = Math.hypot(ball.x - left.x, ball.y - left.y);
        if (d < (G.headR + G.ballR) * 1.7 && hitCooldown <= 0) {
            hit(left, 0.45 + Math.random() * 0.35);
        } else {
            left.swing = 1;
        }
    }

    // ---- Drawing -----------------------------------------------------------
    function drawCourt() {
        ctx.clearRect(0, 0, W, H);

        // Floodlight
        // Radius stops short of the corners so the glow never shows a hard edge
        var grad = ctx.createRadialGradient(W * 0.5, -H * 0.05, 0, W * 0.5, -H * 0.05, W * 0.5);
        grad.addColorStop(0, COLORS.glow + "0.28)");
        grad.addColorStop(0.5, COLORS.glow + "0.08)");
        grad.addColorStop(1, COLORS.glow + "0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = COLORS.ink;
        ctx.lineCap = "round";

        // Court lines behind the floor, in light perspective
        ctx.globalAlpha = 0.13;
        ctx.lineWidth = 1.5;
        var rows = [0.055, 0.115];
        rows.forEach(function (f) {
            ctx.beginPath(); ctx.moveTo(0, G.floor + H * f); ctx.lineTo(W, G.floor + H * f); ctx.stroke();
        });
        var cols = [[0.08, 0.04], [0.28, 0.26], [0.72, 0.74], [0.92, 0.96]];
        cols.forEach(function (c) {
            ctx.beginPath(); ctx.moveTo(W * c[0], G.floor); ctx.lineTo(W * c[1], H); ctx.stroke();
        });

        // Floor
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, G.floor); ctx.lineTo(W, G.floor); ctx.stroke();

        // Net
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(G.netX, G.floor); ctx.lineTo(G.netX, G.floor - G.netH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(G.netX, G.floor - G.netH); ctx.lineTo(G.netX, G.floor - G.netH + 3); ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function drawRacket(r) {
        var R = G.headR;
        var baseTilt = r.dir === 1 ? -0.2 : 0.2;
        var swingAngle = Math.sin(r.swing * Math.PI) * 0.95 * r.dir;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(baseTilt + swingAngle);
        ctx.strokeStyle = COLORS.ink;
        ctx.lineCap = "round";

        // Strings
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1;
        for (var i = -2; i <= 2; i++) {
            var x = i * R * 0.32;
            var yy = Math.sqrt(Math.max(0, 1 - (x / (R * 0.82)) * (x / (R * 0.82)))) * R;
            ctx.beginPath(); ctx.moveTo(x, -yy); ctx.lineTo(x, yy); ctx.stroke();
            var y = i * R * 0.38;
            var xx = Math.sqrt(Math.max(0, 1 - (y / R) * (y / R))) * R * 0.82;
            ctx.beginPath(); ctx.moveTo(-xx, y); ctx.lineTo(xx, y); ctx.stroke();
        }

        // Frame
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, R * 0.82, R, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Throat + grip
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(0, R);
        ctx.lineTo(0, R * 2.55);
        ctx.stroke();
        ctx.restore();
    }

    function drawBall() {
        if (!ball.alive) return;
        var r = G.ballR;

        // Shadow on the floor, smaller and fainter the higher the ball
        var height = Math.max(0, G.floor - ball.y) / H;
        var sScale = Math.max(0.45, 1 - height * 1.4);
        ctx.save();
        ctx.globalAlpha = Math.max(0.12, 0.38 - height * 0.5);
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.ellipse(ball.x, G.floor + 1, r * 1.1 * sScale, r * 0.32 * sScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Trail
        for (var i = 0; i < trail.length; i++) {
            var f = (i + 1) / trail.length;
            ctx.globalAlpha = 0.12 * f;
            ctx.fillStyle = COLORS.ball;
            ctx.beginPath();
            ctx.arc(trail[i].x, trail[i].y, r * (0.5 + 0.5 * f), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Ball
        ctx.save();
        ctx.translate(ball.x, ball.y);
        var sq = ball.squash;
        var dirAngle = Math.atan2(ball.vy, ball.vx);
        ctx.rotate(dirAngle);
        ctx.scale(1 + 0.18 * sq, 1 - 0.14 * sq);
        ctx.rotate(-dirAngle);

        ctx.shadowColor = COLORS.glow + "0.6)";
        ctx.shadowBlur = 16;
        var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
        g.addColorStop(0, COLORS.ballLight);
        g.addColorStop(0.6, COLORS.ball);
        g.addColorStop(1, COLORS.ballDeep);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Seams
        ctx.rotate(ball.spin);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(1.5, r * 0.16);
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(-r * 1.15, 0, r * 0.95, -0.75, 0.75); ctx.stroke();
        ctx.beginPath(); ctx.arc(r * 1.15, 0, r * 0.95, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
        ctx.restore();
    }

    function drawBursts(dt) {
        for (var i = bursts.length - 1; i >= 0; i--) {
            var b = bursts[i];
            b.t += dt;
            var life = b.small ? 0.25 : 0.35;
            if (b.t > life) { bursts.splice(i, 1); continue; }
            var f = b.t / life;
            ctx.globalAlpha = (1 - f) * 0.7;
            ctx.strokeStyle = b.small ? COLORS.ink : COLORS.ball;
            ctx.lineWidth = 2.5 * (1 - f) + 0.5;
            ctx.beginPath();
            ctx.arc(b.x, b.y, G.ballR * (1 + f * (b.small ? 1.2 : 2.4)), 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawStill() {
        // Reduced motion: one composed frame, nothing moves
        layout();
        left.x = G.leftHomeX; left.y = G.homeY;
        right.x = G.rightHomeX; right.y = G.homeY;
        ball.alive = true; ball.x = W * 0.38; ball.y = H * 0.30; ball.vx = 1; ball.vy = 0.4;
        drawCourt(); drawRacket(left); drawRacket(right); drawBall();
    }

    // ---- UI text -----------------------------------------------------------
    function updateScore() {
        if (!scoreEl) return;
        scoreEl.textContent = mode === "auto"
            ? "Rally " + rally
            : "Rally " + rally + " · Best " + best;
    }

    function flash(text, good) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.classList.toggle("good", !!good);
        msgEl.classList.add("show");
        msgTimer = 1.2;
    }

    function setMode(m) {
        if (mode === m) return;
        mode = m;
        root.classList.toggle("is-playing", m !== "auto");
        root.classList.toggle("is-mouse", m === "mouse");
        if (hintEl) {
            hintEl.textContent = m === "touch" ? "Tap to swing"
                : m === "mouse" ? "Move to hit · swing fast for pace"
                : (window.matchMedia("(hover: none)").matches ? "Tap the court to play" : "Move your mouse onto the court to play");
        }
        if (m !== "auto") { best = Math.max(best, rally); }
        updateScore();
    }

    // ---- Input -------------------------------------------------------------
    canvas.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var rect = canvas.getBoundingClientRect();
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        lastInput = performance.now();
        if (mode !== "mouse") {
            left.tx = pointer.x; left.ty = pointer.y;
            setMode("mouse");
        }
    });
    canvas.addEventListener("pointerleave", function (e) {
        if (e.pointerType === "mouse" && mode === "mouse") lastInput = performance.now() - 5200; // fade back within a second
    });
    canvas.addEventListener("pointerdown", function (e) {
        lastInput = performance.now();
        if (e.pointerType === "mouse") {
            // A click swings too, for a burst of pace when the ball is close
            if (ball.alive && ball.vx < 0 && hitCooldown <= 0 &&
                Math.hypot(ball.x - left.x, ball.y - left.y) < (G.headR + G.ballR) * 1.5) {
                hit(left, 0.95);
            } else {
                left.swing = 1;
            }
            return;
        }
        if (mode !== "touch") setMode("touch");
        swing();
    });

    // ---- Loop --------------------------------------------------------------
    var last = 0;
    function frame(now) {
        var dt = Math.min(0.033, (now - last) / 1000 || 0.016);
        last = now;
        if (document.hidden) { requestAnimationFrame(frame); return; }
        step(dt);
        drawCourt();
        drawRacket(left);
        drawRacket(right);
        drawBall();
        drawBursts(dt);
        requestAnimationFrame(frame);
    }

    if ("ResizeObserver" in window) {
        new ResizeObserver(function () {
            var oldW = W;
            layout();
            if (oldW && oldW !== W) reset();
            if (reduceMotion) drawStill();
        }).observe(root);
    } else {
        window.addEventListener("resize", function () { layout(); if (reduceMotion) drawStill(); });
    }

    if (reduceMotion) {
        drawStill();
        if (hintEl) hintEl.hidden = true;
        if (scoreEl) scoreEl.hidden = true;
        return;
    }

    reset();
    setMode("auto");
    updateScore();
    requestAnimationFrame(function (t) { last = t; frame(t); });

    // Read-only peek for tooling and tinkering
    window.__rally = { ball: ball, left: left, right: right, geometry: G, get mode() { return mode; }, get rally() { return rally; } };
})();
