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
          
          .name {
              font-size: 2.5em;
              font-weight: bold;
              margin-bottom: 5px;
              background: linear-gradient(45deg, #fff, #ccc);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
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
          
          .status {
              display: inline-block;
              padding: 8px 16px;
              background: rgba(76, 175, 80, 0.2);
              color: #4caf50;
              border-radius: 20px;
              font-size: 0.9em;
              border: 1px solid rgba(76, 175, 80, 0.3);
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
          }
      </style>
  </head>
  <body>
      <video class="background-video" autoplay muted loop playsinline>
          <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
          Your browser does not support the video tag.
      </video>
      
      <div class="container">
          <div class="profile-card">
              <div class="profile-pic">
                  <img src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012955830358186/03ec152ca2681844ffb0082d6180fe6e.webp?ex=68fbde2b&is=68fa8cab&hm=4d8b7a7409ee052540a24869da6a59c3750193b0ccda7c41df1954ddcc5d3133&" alt="Profile Picture">
              </div>
              
              <h1 class="name">Black</h1>
              <div class="username">@zhuisud_9</div>
              
              <div class="description">
                  Soon own website<br>
                  Building the future one line at a time
              </div>
              
              <div class="status">🟢 Online</div>
              
              <div class="social-links">
                  <a href="#" class="social-link">📷</a>
                  <a href="#" class="social-link">🐦</a>
                  <a href="#" class="social-link">📺</a>
                  <a href="#" class="social-link">💻</a>
              </div>
          </div>
      </div>

      <script>
          document.addEventListener('mousemove', (e) => {
              const card = document.querySelector('.profile-card');
              const x = (window.innerWidth - e.pageX) / 50;
              const y = (window.innerHeight - e.pageY) / 50;
              card.style.transform = 'translateY(' + y + 'px) translateX(' + x + 'px)';
          });
          
          function createParticle() {
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
