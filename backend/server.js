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
              font-family: 'Inter', 'Arial', sans-serif;
          }
          
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
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
              filter: brightness(0.7);
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
              background: rgba(0, 0, 0, 0.4);
              backdrop-filter: blur(25px);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 24px;
              padding: 50px 40px;
              text-align: center;
              max-width: 480px;
              width: 90%;
              box-shadow: 
                  0 25px 50px rgba(0, 0, 0, 0.5),
                  0 0 0 1px rgba(255, 255, 255, 0.05);
              opacity: 0;
              transform: scale(0.8) translateY(30px);
              transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
          }
          
          .profile-card.show {
              opacity: 1;
              transform: scale(1) translateY(0);
          }
          
          .profile-pic {
              width: 160px;
              height: 160px;
              border-radius: 50%;
              border: 3px solid rgba(255, 255, 255, 0.3);
              margin: 0 auto 25px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              position: relative;
              transition: all 0.4s ease;
          }
          
          .profile-pic:hover {
              border-color: rgba(255, 255, 255, 0.6);
              transform: scale(1.05);
          }
          
          .profile-pic::before {
              content: '';
              position: absolute;
              top: -2px;
              left: -2px;
              right: -2px;
              bottom: -2px;
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
              border-radius: 50%;
              z-index: -1;
              opacity: 0;
              transition: opacity 0.4s ease;
          }
          
          .profile-pic:hover::before {
              opacity: 1;
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
              gap: 12px;
              margin-bottom: 8px;
          }
          
          .name {
              font-size: 3em;
              font-weight: 700;
              background: linear-gradient(135deg, #fff 0%, #a8b2d1 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              letter-spacing: -0.5px;
          }
          
          .owner-badge {
              font-size: 1.2em;
              opacity: 0.9;
              position: relative;
              cursor: help;
              animation: crownGlow 2s ease-in-out infinite alternate;
              filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));
          }
          
          .owner-badge:hover {
              animation: crownSpin 0.6s ease-in-out;
          }
          
          .owner-badge:hover::after {
              content: 'Owner';
              position: absolute;
              top: -40px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0, 0, 0, 0.8);
              color: #ffd700;
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 0.8em;
              font-weight: 500;
              white-space: nowrap;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 215, 0, 0.3);
          }
          
          .username {
              color: #a8b2d1;
              font-size: 1.3em;
              margin-bottom: 25px;
              font-weight: 400;
              letter-spacing: 0.5px;
          }
          
          .description {
              color: #8892b0;
              font-size: 1.2em;
              line-height: 1.6;
              margin-bottom: 35px;
              font-weight: 300;
          }
          
          .social-links {
              display: flex;
              justify-content: center;
              gap: 20px;
              margin-top: 30px;
          }
          
          .social-link {
              width: 50px;
              height: 50px;
              border-radius: 50%;
              background: rgba(255, 255, 255, 0.08);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #a8b2d1;
              text-decoration: none;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              border: 1px solid rgba(255, 255, 255, 0.1);
              font-size: 1.2em;
          }
          
          .social-link:hover {
              background: rgba(255, 255, 255, 0.15);
              transform: translateY(-3px) scale(1.1);
              color: #fff;
              border-color: rgba(255, 255, 255, 0.3);
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          }
          
          .volume-control {
              position: fixed;
              top: 25px;
              left: 25px;
              background: rgba(0, 0, 0, 0.3);
              padding: 20px;
              border-radius: 16px;
              backdrop-filter: blur(20px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
              transition: all 0.3s ease;
          }
          
          .volume-control:hover {
              background: rgba(0, 0, 0, 0.4);
              border-color: rgba(255, 255, 255, 0.2);
          }
          
          .volume-slider-container {
              display: flex;
              align-items: center;
              gap: 15px;
              min-width: 200px;
          }
          
          .volume-icon {
              font-size: 1.3em;
              color: #a8b2d1;
              min-width: 30px;
              text-align: center;
          }
          
          .volume-slider {
              flex: 1;
              height: 6px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
              outline: none;
              -webkit-appearance: none;
          }
          
          .volume-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #fff;
              cursor: pointer;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
              transition: all 0.2s ease;
          }
          
          .volume-slider::-webkit-slider-thumb:hover {
              background: #ffd700;
              transform: scale(1.1);
          }
          
          .volume-percentage {
              color: #a8b2d1;
              font-size: 0.9em;
              font-weight: 500;
              min-width: 35px;
              text-align: center;
          }
          
          .click-to-play {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              color: white;
              cursor: pointer;
              transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
              gap: 20px;
          }
          
          .click-title {
              font-size: 3.5em;
              font-weight: 700;
              background: linear-gradient(135deg, #fff 0%, #a8b2d1 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              text-align: center;
              letter-spacing: 2px;
              animation: titlePulse 2s ease-in-out infinite;
          }
          
          .click-subtitle {
              font-size: 1.2em;
              color: #8892b0;
              font-weight: 300;
              letter-spacing: 1px;
          }
          
          .click-to-play.hide {
              opacity: 0;
              pointer-events: none;
          }
          
          @keyframes crownGlow {
              0% {
                  transform: scale(1) rotate(0deg);
                  filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.3));
              }
              100% {
                  transform: scale(1.1) rotate(5deg);
                  filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.6));
              }
          }
          
          @keyframes crownSpin {
              0% { transform: rotate(0deg) scale(1.1); }
              25% { transform: rotate(15deg) scale(1.2); }
              50% { transform: rotate(0deg) scale(1.3); }
              75% { transform: rotate(-15deg) scale(1.2); }
              100% { transform: rotate(0deg) scale(1.1); }
          }
          
          @keyframes titlePulse {
              0%, 100% {
                  transform: scale(1);
                  opacity: 1;
              }
              50% {
                  transform: scale(1.05);
                  opacity: 0.8;
              }
          }
          
          @keyframes float {
              0%, 100% {
                  transform: translateY(0px) rotate(0deg);
              }
              33% {
                  transform: translateY(-10px) rotate(1deg);
              }
              66% {
                  transform: translateY(-5px) rotate(-1deg);
              }
          }
          
          .profile-card {
              animation: float 8s ease-in-out infinite;
          }
          
          @media (max-width: 768px) {
              .profile-card {
                  padding: 40px 25px;
                  max-width: 90%;
              }
              
              .profile-pic {
                  width: 140px;
                  height: 140px;
              }
              
              .name {
                  font-size: 2.5em;
              }
              
              .click-title {
                  font-size: 2.5em;
              }
              
              .volume-control {
                  top: 15px;
                  left: 15px;
                  right: 15px;
                  padding: 15px;
              }
              
              .volume-slider-container {
                  min-width: auto;
              }
          }
          
          .particle {
              position: fixed;
              pointer-events: none;
              z-index: 0;
          }
      </style>
  </head>
  <body>
      <div class="click-to-play" id="clickToPlay">
          <div class="click-title">CLICK ANYWHERE TO PLAY</div>
          <div class="click-subtitle">Experience the vibe</div>
      </div>
      
      <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
          <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
          Your browser does not support the video tag.
      </video>
      
      <div class="volume-control" id="volumeControl" style="display: none;">
          <div class="volume-slider-container">
              <div class="volume-icon">🔊</div>
              <input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="50">
              <div class="volume-percentage" id="volumePercentage">50%</div>
          </div>
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
          const volumePercentage = document.getElementById('volumePercentage');
          const backgroundVideo = document.getElementById('backgroundVideo');
          
          let audio = null;
          let hasInteracted = false;
          
          function initializeAudio() {
              if (hasInteracted) return;
              
              audio = new Audio('https://cdn.discordapp.com/attachments/1415024144105603186/1431016663683305472/james_bandz_-_Swat_Me_Maybe_Lyrics.mp3?ex=68fbe19f&is=68fa901f&hm=7be358d8d9b012292cafb0c5d4e2bbb158a6c090f62a85c3b877e812da9d27cc&');
              audio.loop = true;
              updateVolume();
              
              audio.play().then(() => {
                  console.log('Audio started playing');
              }).catch(error => {
                  console.log('Audio play failed:', error);
              });
              
              hasInteracted = true;
          }
          
          function updateVolume() {
              if (audio) {
                  audio.volume = volumeSlider.value / 100;
              }
              volumePercentage.textContent = volumeSlider.value + '%';
          }
          
          function showContent() {
              clickToPlay.classList.add('hide');
              volumeControl.style.display = 'block';
              profileCard.classList.add('show');
              
              setTimeout(() => {
                  initializeAudio();
              }, 800);
          }
          
          clickToPlay.addEventListener('click', showContent);
          
          document.addEventListener('keypress', (e) => {
              if (e.code === 'Space' || e.code === 'Enter') {
                  showContent();
              }
          });
          
          volumeSlider.addEventListener('input', updateVolume);
          
          document.addEventListener('mousemove', (e) => {
              if (hasInteracted) {
                  createParticle(e.clientX, e.clientY);
              }
          });
          
          function createParticle(x, y) {
              const particle = document.createElement('div');
              particle.className = 'particle';
              particle.style.left = x + 'px';
              particle.style.top = y + 'px';
              
              const size = Math.random() * 6 + 2;
              particle.style.width = size + 'px';
              particle.style.height = size + 'px';
              
              const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffd700'];
              const color = colors[Math.floor(Math.random() * colors.length)];
              particle.style.background = color;
              particle.style.borderRadius = '50%';
              
              document.body.appendChild(particle);
              
              const animation = particle.animate([
                  { 
                      transform: 'translate(0, 0) scale(1)',
                      opacity: 1
                  },
                  { 
                      transform: 'translate(' + (Math.random() * 100 - 50) + 'px, ' + (Math.random() * 100 - 50) + 'px) scale(0)',
                      opacity: 0
                  }
              ], {
                  duration: Math.random() * 2000 + 1000,
                  easing: 'cubic-bezier(0.2, 0, 0.8, 1)'
              });
              
              animation.onfinish = () => particle.remove();
          }
          
          console.log('Welcome to Black premium profile!');
      </script>
  </body>
  </html>
  `);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Premium Profile page running on port ' + PORT);
  console.log('👉 Open: http://localhost:' + PORT);
});
