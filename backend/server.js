const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.static('.'));

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Black</title>
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: 'Arial', sans-serif;
          }
          
          body {
              background: #000;
              color: white;
              height: 100vh;
              overflow: hidden;
              position: relative;
              cursor: default;
          }
          
          .background-video {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              z-index: -1;
          }
          
          .container {
              display: flex;
              height: 100vh;
              align-items: center;
              justify-content: center;
              position: relative;
              z-index: 1;
          }
          
          .profile-card {
              background: rgba(0, 0, 0, 0.8);
              backdrop-filter: blur(20px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              padding: 40px;
              text-align: center;
              max-width: 400px;
              width: 90%;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
              opacity: 0;
              transform: scale(0.8);
              transition: all 0.5s ease;
          }
          
          .profile-card.show {
              opacity: 1;
              transform: scale(1);
          }
          
          .profile-pic {
              width: 150px;
              height: 150px;
              border-radius: 50%;
              border: 3px solid #fff;
              margin: 0 auto 20px;
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
          }
          
          .profile-pic img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              border-radius: 50%;
          }
          
          .name-container {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              margin-bottom: 5px;
          }
          
          .name {
              font-size: 2.5em;
              font-weight: bold;
              background: linear-gradient(45deg, #fff, #ccc);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
          }
          
          .owner-badge {
              background: linear-gradient(45deg, #ffd700, #ffed4e);
              color: #000;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 0.7em;
              font-weight: bold;
              position: relative;
              cursor: help;
          }
          
          .owner-badge:hover::after {
              content: 'Owner';
              position: absolute;
              top: -30px;
              left: 50%;
              transform: translateX(-50%);
              background: #333;
              color: white;
              padding: 5px 10px;
              border-radius: 5px;
              font-size: 0.8em;
              white-space: nowrap;
          }
          
          .username {
              color: #888;
              font-size: 1.2em;
              margin-bottom: 20px;
              font-weight: 300;
          }
          
          .description {
              color: #bbb;
              font-size: 1.1em;
              line-height: 1.5;
              margin-bottom: 30px;
          }
          
          .social-links {
              display: flex;
              justify-content: center;
              gap: 15px;
              margin-top: 25px;
          }
          
          .social-link {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: rgba(255, 255, 255, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              text-decoration: none;
              transition: all 0.3s ease;
              border: 1px solid rgba(255, 255, 255, 0.2);
          }
          
          .social-link:hover {
              background: rgba(255, 255, 255, 0.2);
              transform: translateY(-2px);
          }
          
          .volume-control {
              position: fixed;
              left: 20px;
              top: 50%;
              transform: translateY(-50%);
              background: rgba(0, 0, 0, 0.7);
              padding: 15px;
              border-radius: 10px;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .volume-slider {
              writing-mode: bt-lr;
              -webkit-appearance: slider-vertical;
              width: 10px;
              height: 120px;
              background: #333;
              outline: none;
              border-radius: 5px;
          }
          
          .volume-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #fff;
              cursor: pointer;
          }
          
          .volume-label {
              color: white;
              font-size: 0.8em;
              margin-bottom: 10px;
              text-align: center;
          }
          
          .click-to-play {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.9);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              font-size: 2em;
              color: white;
              cursor: pointer;
              transition: opacity 0.5s ease;
          }
          
          .click-to-play.hide {
              opacity: 0;
              pointer-events: none;
          }
          
          .profile-card {
              animation: float 6s ease-in-out infinite;
          }
          
          @keyframes float {
              0%, 100% {
                  transform: translateY(0px);
              }
              50% {
                  transform: translateY(-10px);
              }
          }
          
          @media (max-width: 768px) {
              .profile-card {
                  padding: 30px 20px;
              }
              
              .profile-pic {
                  width: 120px;
                  height: 120px;
              }
              
              .name {
                  font-size: 2em;
              }
              
              .volume-control {
                  left: 10px;
                  padding: 10px;
              }
              
              .volume-slider {
                  height: 100px;
              }
          }
      </style>
  </head>
  <body>
      <div class="click-to-play" id="clickToPlay">
          CLICK ANYWHERE TO PLAY
      </div>
      
      <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
          <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
          Your browser does not support the video tag.
      </video>
      
      <div class="volume-control" id="volumeControl" style="display: none;">
          <div class="volume-label">VOLUME</div>
          <input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="50" orient="vertical">
      </div>
      
      <div class="container">
          <div class="profile-card" id="profileCard">
              <div class="profile-pic">
                  <img src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012955830358186/03ec152ca2681844ffb0082d6180fe6e.webp?ex=68fbde2b&is=68fa8cab&hm=4d8b7a7409ee052540a24869da6a59c3750193b0ccda7c41df1954ddcc5d3133&" alt="Profile Picture">
              </div>
              
              <div class="name-container">
                  <h1 class="name">Black</h1>
                  <div class="owner-badge">👑</div>
              </div>
              
              <div class="username">@zhuisud_9</div>
              
              <div class="description">
                  Soon own website<br>
                  Building the future one line at a time
              </div>
              
              <div class="social-links">
                  <a href="#" class="social-link">📷</a>
                  <a href="#" class="social-link">🐦</a>
                  <a href="#" class="social-link">📺</a>
                  <a href="#" class="social-link">💻</a>
              </div>
          </div>
      </div>

      <script>
          const clickToPlay = document.getElementById('clickToPlay');
          const profileCard = document.getElementById('profileCard');
          const volumeControl = document.getElementById('volumeControl');
          const volumeSlider = document.getElementById('volumeSlider');
          const backgroundVideo = document.getElementById('backgroundVideo');
          
          let audio = null;
          let hasInteracted = false;
          
          function initializeAudio() {
              if (hasInteracted) return;
              
              audio = new Audio('https://cdn.discordapp.com/attachments/1415024144105603186/1431016663683305472/james_bandz_-_Swat_Me_Maybe_Lyrics.mp3?ex=68fbe19f&is=68fa901f&hm=7be358d8d9b012292cafb0c5d4e2bbb158a6c090f62a85c3b877e812da9d27cc&');
              audio.loop = true;
              audio.volume = volumeSlider.value / 100;
              
              audio.play().then(() => {
                  console.log('Audio started playing');
              }).catch(error => {
                  console.log('Audio play failed:', error);
              });
              
              hasInteracted = true;
          }
          
          function showContent() {
              clickToPlay.classList.add('hide');
              volumeControl.style.display = 'block';
              profileCard.classList.add('show');
              
              setTimeout(() => {
                  initializeAudio();
              }, 500);
          }
          
          clickToPlay.addEventListener('click', showContent);
          
          document.addEventListener('keypress', (e) => {
              if (e.code === 'Space' || e.code === 'Enter') {
                  showContent();
              }
          });
          
          volumeSlider.addEventListener('input', function() {
              if (audio) {
                  audio.volume = this.value / 100;
              }
          });
          
          document.addEventListener('mousemove', (e) => {
              if (hasInteracted) {
                  const card = document.querySelector('.profile-card');
                  const x = (window.innerWidth - e.pageX) / 50;
                  const y = (window.innerHeight - e.pageY) / 50;
                  card.style.transform = 'translateY(' + y + 'px) translateX(' + x + 'px)';
              }
          });
          
          function createParticle() {
              if (!hasInteracted) return;
              
              const particle = document.createElement('div');
              particle.style.position = 'fixed';
              particle.style.width = '4px';
              particle.style.height = '4px';
              particle.style.background = 'rgba(255, 255, 255, 0.5)';
              particle.style.borderRadius = '50%';
              particle.style.pointerEvents = 'none';
              particle.style.zIndex = '0';
              
              particle.style.left = Math.random() * 100 + 'vw';
              particle.style.top = '100vh';
              
              document.body.appendChild(particle);
              
              const animation = particle.animate([
                  { transform: 'translateY(0) scale(1)', opacity: 1 },
                  { transform: 'translateY(-' + (Math.random() * 100 + 50) + 'vh) scale(0)', opacity: 0 }
              ], {
                  duration: Math.random() * 3000 + 2000,
                  easing: 'cubic-bezier(0.2, 0, 0.8, 1)'
              });
              
              animation.onfinish = function() { particle.remove(); };
          }
          
          setInterval(createParticle, 500);
          
          console.log('Welcome to Black profile!');
      </script>
  </body>
  </html>
  `);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Profile page running on port ' + PORT);
  console.log('👉 Open: http://localhost:' + PORT);
});
