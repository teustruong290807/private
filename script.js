// Thay LINK_CỦA_BẠN_Ở_ĐÂY bằng URL Web App bạn vừa copy từ Google Apps Script
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx2pGlTtZBjIoUUzaezVH1iAKwmaP9rwgbXdrUBmPzLoGRO7ST_811-lxlK5_o20wi-bQ/exec";

let database = []; // Biến trống, sẽ được nhồi dữ liệu từ Google Sheet vào

document.addEventListener("DOMContentLoaded", () => {
  const dashboardScreen = document.getElementById("dashboard-screen");
  const quizContainer = document.getElementById("quiz-container");
  const resultScreen = document.getElementById("result-screen");
  
  const quizListEl = document.getElementById("quiz-list");
  const quizContentEl = document.getElementById("quiz-content");
  const questionGridEl = document.getElementById("question-grid");
  const btnSubmit = document.getElementById("btn-submit");
  
  let currentQuizData = null; 
  let userAnswers = {};       
  let startTime = 0;          
  let timerId = null;         

  // --- HÀM TẢI DỮ LIỆU TỪ GOOGLE SHEETS ---
  async function loadDataFromSheet() {
    const tbody = document.getElementById("quiz-list-tbody");
    if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Đang tải dữ liệu từ kho đề... ⏳</td></tr>";
    
    try {
      const response = await fetch(APPS_SCRIPT_URL);
      database = await response.json();
      renderDashboard(); // Sau khi tải xong thì in ra bảng
    } catch (error) {
      if (tbody) tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>Lỗi tải dữ liệu. Vui lòng kiểm tra lại link Google Sheets!</td></tr>";
      console.error(error);
    }
  }

  // Đổi dòng gọi hàm ở CUỐI CÙNG của file script.js từ renderDashboard() thành:
  loadDataFromSheet();

  // (Phần code các hàm renderDashboard, startSpecificQuiz... bên dưới GIỮ NGUYÊN)

  // --- 3. HIỂN THỊ DANH SÁCH ĐỀ (DẠNG BẢNG) ---
  function renderDashboard() {
    const tbody = document.getElementById("quiz-list-tbody");
    if (!tbody) return; // Tránh lỗi nếu không ở trang chủ
    tbody.innerHTML = "";
    
    database.forEach((quiz, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-stt">${index + 1}</td>
        <td class="fw-bold">${quiz.title}</td>
        <td class="col-time">${quiz.timeMinutes} phút</td>
        <td class="col-action">
          <button class="btn-enter-quiz" data-quizid="${quiz.quizId}">Vào thi</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-enter-quiz").forEach(btn => {
      btn.addEventListener("click", function() {
        startSpecificQuiz(this.getAttribute("data-quizid"));
      });
    });
  }

  function startSpecificQuiz(quizId) {
    currentQuizData = database.find(q => q.quizId === quizId);
    document.querySelector(".quiz-title").innerText = currentQuizData.title;
    
    userAnswers = {};
    quizContentEl.innerHTML = "";
    questionGridEl.innerHTML = "";
    document.querySelector(".main-content").classList.remove("review-mode");
    
    dashboardScreen.classList.add("hidden");
    quizContainer.classList.remove("hidden");
    
    renderQuizQuestions(currentQuizData.questions);
    startTimer(currentQuizData.timeMinutes * 60);
    startTime = Date.now();
  }

  function renderQuizQuestions(questions) {
    questions.forEach((item) => {
      // Nút lưới bên trái
      const gridBtn = document.createElement("button");
      gridBtn.className = "q-btn";
      gridBtn.innerText = item.id;
      gridBtn.id = `btn-q${item.id}`;
      gridBtn.addEventListener("click", () => {
        document.getElementById(`question-${item.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      questionGridEl.appendChild(gridBtn);

      // Khối nội dung bên phải
      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.id = `question-${item.id}`;

      // PHÂN LOẠI CÂU HỎI
      if (item.type === "true_false") {
        let trHTML = "";
        item.statements.forEach(stmt => {
          trHTML += `
            <tr>
              <td><strong>${stmt.id})</strong> ${stmt.text}</td>
              <td><button class="tf-btn" data-question="${item.id}" data-statement="${stmt.id}" data-answer="Đúng">Đ</button></td>
              <td><button class="tf-btn" data-question="${item.id}" data-statement="${stmt.id}" data-answer="Sai">S</button></td>
            </tr>
          `;
        });
        qBlock.innerHTML = `
          <div class="question-text">Câu ${item.id}: ${item.question}</div>
          ${item.context ? `<div class="context-text">${item.context.replace(/\n/g, '<br>')}</div>` : ""}
          <table class="tf-table">
            <thead><tr><th>Nhận định</th><th>Đúng</th><th>Sai</th></tr></thead>
            <tbody>${trHTML}</tbody>
          </table>
        `;
      } else {
        // Câu trắc nghiệm truyền thống
        let optionsHTML = "";
        for (const [letter, text] of Object.entries(item.options)) {
          optionsHTML += `
            <div class="option-item" data-question="${item.id}" data-answer="${letter}" id="opt-${item.id}-${letter}">
              <span class="option-letter">${letter}</span><span class="option-text">${text}</span>
            </div>
          `;
        }
        qBlock.innerHTML = `<div class="question-text">Câu ${item.id}: ${item.question}</div><div class="options-group">${optionsHTML}</div>`;
      }
      quizContentEl.appendChild(qBlock);
    });

    attachOptionListeners();
  }

  function attachOptionListeners() {
    // Logic cho câu Trắc nghiệm thường
    document.querySelectorAll(".option-item").forEach(option => {
      option.addEventListener("click", function() {
        const qId = this.getAttribute("data-question");
        document.querySelectorAll(`.option-item[data-question="${qId}"]`).forEach(sib => sib.classList.remove("selected"));
        this.classList.add("selected");
        userAnswers[qId] = this.getAttribute("data-answer");
        
        const gridBtn = document.getElementById(`btn-q${qId}`);
        if(gridBtn) gridBtn.classList.add("answered");
      });
    });

    // Logic cho câu Đúng/Sai
    document.querySelectorAll(".tf-btn").forEach(btn => {
      btn.addEventListener("click", function() {
        const qId = this.getAttribute("data-question");
        const sId = this.getAttribute("data-statement");
        
        document.querySelectorAll(`.tf-btn[data-question="${qId}"][data-statement="${sId}"]`).forEach(sib => sib.classList.remove("selected"));
        this.classList.add("selected");
        userAnswers[`${qId}_${sId}`] = this.getAttribute("data-answer");

        // Kiểm tra xem đã làm đủ các ý của câu Đúng/Sai chưa
        const currentQuestion = currentQuizData.questions.find(q => q.id == qId);
        let allAnswered = true;
        currentQuestion.statements.forEach(stmt => {
          if (!userAnswers[`${qId}_${stmt.id}`]) allAnswered = false;
        });

        if (allAnswered) {
          const gridBtn = document.getElementById(`btn-q${qId}`);
          if(gridBtn) gridBtn.classList.add("answered");
        }
      });
    });
  }

  function startTimer(totalSeconds) {
    let timeLeft = totalSeconds; 
    const timerEl = document.getElementById("timer");
    clearInterval(timerId); 
    timerId = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(timerId); timerEl.innerText = "00:00:00"; submitQuiz(); 
      } else {
        let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
        timerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        timeLeft--;
      }
    }, 1000);
  }

  function submitQuiz() {
    clearInterval(timerId); 
    let correctActions = 0, wrongActions = 0, skippedActions = 0;
    
    let totalMaxScore = currentQuizData.questions.length; // Mỗi câu tối đa 1 điểm
    let totalEarnedScore = 0;

    currentQuizData.questions.forEach(item => {
      if (item.type === "true_false") {
        let stmtCorrect = 0;
        item.statements.forEach(stmt => {
          const uAns = userAnswers[`${item.id}_${stmt.id}`];
          const correctAns = stmt.correctAnswer;

          const btnDung = document.querySelector(`.tf-btn[data-question="${item.id}"][data-statement="${stmt.id}"][data-answer="Đúng"]`);
          const btnSai = document.querySelector(`.tf-btn[data-question="${item.id}"][data-statement="${stmt.id}"][data-answer="Sai"]`);
          if (btnDung && correctAns === "Đúng") btnDung.classList.add("correct-ans");
          if (btnSai && correctAns === "Sai") btnSai.classList.add("correct-ans");

          if (!uAns) {
            skippedActions++;
          } else if (uAns === correctAns) {
            stmtCorrect++; correctActions++;
          } else {
            wrongActions++;
            const wrongBtn = document.querySelector(`.tf-btn[data-question="${item.id}"][data-statement="${stmt.id}"][data-answer="${uAns}"]`);
            if (wrongBtn) wrongBtn.classList.add("wrong-ans");
          }
        });

        // Chấm điểm theo chuẩn 2025 cho 4 nhận định
        if (item.statements.length === 4) {
          if (stmtCorrect === 1) totalEarnedScore += 0.1;
          else if (stmtCorrect === 2) totalEarnedScore += 0.25;
          else if (stmtCorrect === 3) totalEarnedScore += 0.5;
          else if (stmtCorrect === 4) totalEarnedScore += 1.0;
        } else {
          totalEarnedScore += (stmtCorrect / item.statements.length); // Fallback dự phòng
        }

      } else {
        // Chấm điểm Trắc nghiệm truyền thống
        const uAns = userAnswers[item.id];
        const correctAns = item.correctAnswer;
        const correctNode = document.getElementById(`opt-${item.id}-${correctAns}`);
        if(correctNode) correctNode.classList.add("correct-ans");

        if (!uAns) {
          skippedActions++;
        } else if (uAns === correctAns) {
          totalEarnedScore += 1; correctActions++;
        } else {
          wrongActions++;
          const wrongNode = document.getElementById(`opt-${item.id}-${uAns}`);
          if(wrongNode) wrongNode.classList.add("wrong-ans");
        }
      }
    });

    let score = (totalEarnedScore / totalMaxScore) * 10;
    score = Number(score.toFixed(2)); 

    const timeTakenSecs = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("final-score").innerText = score;
    document.getElementById("final-status").innerText = score >= 5 ? "(Đạt)" : "(Không đạt)";
    document.getElementById("stat-correct").innerText = correctActions;
    document.getElementById("stat-incorrect").innerText = wrongActions;
    document.getElementById("stat-skipped").innerText = skippedActions;
    document.getElementById("time-taken-text").innerText = `${Math.floor(timeTakenSecs / 60)} phút ${timeTakenSecs % 60} giây`;

    quizContainer.classList.add("hidden");
    resultScreen.classList.remove("hidden");
  }

  if(btnSubmit) {
    btnSubmit.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn nộp bài không?")) submitQuiz();
    });
  }

  document.getElementById("btn-retry").addEventListener("click", () => {
    resultScreen.classList.add("hidden");
    startSpecificQuiz(currentQuizData.quizId); 
  });

  document.getElementById("btn-view-rank").addEventListener("click", () => { alert("Tính năng xếp hạng đang được phát triển!"); });

  document.getElementById("btn-view-result").addEventListener("click", () => {
    resultScreen.classList.add("hidden");
    quizContainer.classList.remove("hidden");
    document.querySelector(".main-content").classList.add("review-mode");
    
    btnSubmit.innerText = "Trở về Trang chủ";
    btnSubmit.onclick = () => { window.location.reload(); };
  });

});
