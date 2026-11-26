// The Elang bush plane, drawn in chase view from behind and slightly
// above: the nose points away up-screen and is foreshortened, the tail is
// big and close, the wings span wide, and the navigation lights blink.
// It banks with the roll and lifts its nose with the pitch.
export function drawAircraft(ctx, cx, cy, scale, roll, pitch, time, lightsOn) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  ctx.scale(scale, scale);
  // A little nose-up lift when the pilot pulls back.
  ctx.translate(0, -pitch * 20);

  const body = ctx.createLinearGradient(-14, 0, 14, 0);
  body.addColorStop(0, '#e9edf1');
  body.addColorStop(0.5, '#ffffff');
  body.addColorStop(1, '#c9d2da');
  const wingGrad = ctx.createLinearGradient(0, -12, 0, 14);
  wingGrad.addColorStop(0, '#eef1f4');
  wingGrad.addColorStop(1, '#aeb9c2');

  // Tailplane, low and wide behind the wing.
  ctx.fillStyle = '#c8442e';
  ctx.beginPath();
  ctx.moveTo(-11, 40);
  ctx.lineTo(-56, 52);
  ctx.lineTo(-54, 60);
  ctx.lineTo(-9, 52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, 40);
  ctx.lineTo(56, 52);
  ctx.lineTo(54, 60);
  ctx.lineTo(9, 52);
  ctx.closePath();
  ctx.fill();

  // Vertical fin, rising toward the viewer.
  ctx.fillStyle = '#c8442e';
  ctx.beginPath();
  ctx.moveTo(-8, 44);
  ctx.lineTo(0, 82);
  ctx.lineTo(8, 44);
  ctx.lineTo(5, 30);
  ctx.lineTo(-5, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 74);
  ctx.lineTo(-3.5, 60);
  ctx.lineTo(3.5, 60);
  ctx.closePath();
  ctx.fill();

  // Fuselage: short and foreshortened, wide at the tail, narrow at the nose.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-13, 48);
  ctx.quadraticCurveTo(-16, 12, -9, -24);
  ctx.quadraticCurveTo(-5, -32, 0, -32);
  ctx.quadraticCurveTo(5, -32, 9, -24);
  ctx.quadraticCurveTo(16, 12, 13, 48);
  ctx.quadraticCurveTo(0, 56, -13, 48);
  ctx.closePath();
  ctx.fill();

  // Red cheatline down the fuselage sides.
  ctx.fillStyle = '#c8442e';
  ctx.beginPath();
  ctx.moveTo(-12, 34);
  ctx.quadraticCurveTo(-13, 4, -8, -20);
  ctx.lineTo(-4, -20);
  ctx.quadraticCurveTo(-8, 4, -7, 34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, 34);
  ctx.quadraticCurveTo(13, 4, 8, -20);
  ctx.lineTo(4, -20);
  ctx.quadraticCurveTo(8, 4, 7, 34);
  ctx.closePath();
  ctx.fill();

  // Cockpit windows at the nose, catching the sun.
  ctx.fillStyle = '#1d3a4d';
  ctx.beginPath();
  ctx.moveTo(-6, -20);
  ctx.lineTo(6, -20);
  ctx.lineTo(4, -29);
  ctx.lineTo(-4, -29);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(-5, -21);
  ctx.lineTo(-1, -21);
  ctx.lineTo(-2, -28);
  ctx.lineTo(-4, -28);
  ctx.closePath();
  ctx.fill();

  // Main wing, spanning wide across the fuselage.
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-9, -2);
  ctx.lineTo(-126, -16);
  ctx.lineTo(-130, -4);
  ctx.lineTo(-10, 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, -2);
  ctx.lineTo(126, -16);
  ctx.lineTo(130, -4);
  ctx.lineTo(10, 14);
  ctx.closePath();
  ctx.fill();
  // Teal wing tips.
  ctx.fillStyle = '#1f7a6d';
  ctx.beginPath();
  ctx.moveTo(-112, -14);
  ctx.lineTo(-126, -16);
  ctx.lineTo(-130, -4);
  ctx.lineTo(-114, -3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(112, -14);
  ctx.lineTo(126, -16);
  ctx.lineTo(130, -4);
  ctx.lineTo(114, -3);
  ctx.closePath();
  ctx.fill();

  // Registration on the rear fuselage.
  ctx.fillStyle = '#33414d';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-ELG', 0, 40);

  // Navigation lights: red port, green starboard, blinking white tail.
  if (lightsOn) {
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-130, -10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2dff5e';
    ctx.beginPath();
    ctx.arc(130, -10, 4, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 78, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
