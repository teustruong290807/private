document.addEventListener("DOMContentLoaded", () => {
  // --- 1. LẤY CÁC THÀNH PHẦN GIAO DIỆN TỪ HTML ---
  const dashboardScreen = document.getElementById("dashboard-screen");
  const quizContainer = document.getElementById("quiz-container");
  const resultScreen = document.getElementById("result-screen");
  
  const quizListEl = document.getElementById("quiz-list");
  const quizContentEl = document.getElementById("quiz-content");
  const questionGridEl = document.getElementById("question-grid");
  const btnSubmit = document.getElementById("btn-submit");
  
  // --- 2. BIẾN LƯU TRẠNG THÁI BÀI LÀM ---
  let currentQuizData = null; // Đề đang làm
  let userAnswers = {};       // Đáp án người dùng chọn
  let startTime = 0;          // Thời gian bắt đầu
  let timerId = null;         // ID của đồng hồ đếm ngược

  // --- 3. HIỂN THỊ DANH SÁCH ĐỀ Ở TRANG CHỦ (DASHBOARD) ---
  function renderDashboard() {
    quizListEl.innerHTML = "";
    
    // Duyệt qua danh sách đề trong file data.js
    database.forEach(quiz => {
      const row = document.createElement("div");
      row.className = "quiz-row";
      
      row.innerHTML = `
        <div class="quiz-row-title">${quiz.title}</div>
        <button class="btn-enter-quiz" data-quizid="${quiz.quizId}">Vào thi</button>
      `;
      quizListEl.appendChild(row);
    });

    // Lắng nghe sự kiện click vào nút "Vào thi"
    const enterBtns = document.querySelectorAll(".btn-enter-quiz");
    enterBtns.forEach(btn => {
      btn.addEventListener("click", function() {
        const targetId = this.getAttribute("data-quizid");
        startSpecificQuiz(targetId);
      });
    });
  }

  // --- 4. BẮT ĐẦU VÀO LÀM MỘT ĐỀ CỤ THỂ ---
  function startSpecificQuiz(quizId) {
    // Lấy dữ liệu của đề thi được chọn
    currentQuizData = database.find(q => q.quizId === quizId);
    
    // Đổi tiêu đề hiển thị
    document.querySelector(".quiz-title").innerText = currentQuizData.title;
    
    // Làm sạch dữ liệu cũ (nếu có)
    userAnswers = {};
    quizContentEl.innerHTML = "";
    questionGridEl.innerHTML = "";
    document.querySelector(".main-content").classList.remove("review-mode");
    
    // Chuyển đổi màn hình: Ẩn Dashboard -> Hiện Quiz
    dashboardScreen.classList.add("hidden");
    quizContainer.classList.remove("hidden");
    
    // Khởi tạo câu hỏi và đồng hồ
    renderQuizQuestions(currentQuizData.questions);
    startTimer(currentQuizData.timeMinutes * 60);
    startTime = Date.now();
  }

  // --- 5. TẠO GIAO DIỆN CÂU HỎI VÀ LƯỚI NÚT BẤM ---
  function renderQuizQuestions(questions) {
    questions.forEach((item) => {
      // 5.1. Tạo nút số thứ tự bên trái
      const gridBtn = document.createElement("button");
      gridBtn.className = "q-btn";
      gridBtn.innerText = item.id;
      gridBtn.id = `btn-q${item.id}`;
      
      // Bấm vào nút số -> Cuộn đến câu hỏi
      gridBtn.addEventListener("click", () => {
        document.getElementById(`question-${item.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      questionGridEl.appendChild(gridBtn);

      // 5.2. Tạo nội dung câu hỏi bên phải
      const qBlock = document.createElement("div");
      qBlock.className = "question-block";
      qBlock.id = `question-${item.id}`;

      let optionsHTML = "";
      for (const [letter, text] of Object.entries(item.options)) {
        optionsHTML += `
          <div class="option-item" data-question="${item.id}" data-answer="${letter}" id="opt-${item.id}-${letter}">
            <span class="option-letter">${letter}</span>
            <span class="option-text">${text}</span>
          </div>
        `;
      }

      qBlock.innerHTML = `
        <div class="question-text">Câu ${item.id}: ${item.question}</div>
        <div class="options-group">${optionsHTML}</div>
      `;
      quizContentEl.appendChild(qBlock);
    });

    // Kích hoạt tính năng chọn đáp án
    attachOptionListeners();
  }

  // --- 6. XỬ LÝ KHI NGƯỜI DÙNG CHỌN ĐÁP ÁN ---
  function attachOptionListeners() {
    const options = document.querySelectorAll(".option-item");
    options.forEach(option => {
      option.addEventListener("click", function() {
        const qId = this.getAttribute("data-question");
        const ans = this.getAttribute("data-answer");

        // Xóa viền xanh ở các đáp án khác trong cùng 1 câu
        const siblings = document.querySelectorAll(`.option-item[data-question="${qId}"]`);
        siblings.forEach(sib => sib.classList.remove("selected"));

        // Tô viền xanh cho đáp án vừa chọn
        this.classList.add("selected");
        
        // Lưu lại đáp án
        userAnswers[qId] = ans;

        // Đổi màu nút số bên trái thành đã làm
        const gridBtn = document.getElementById(`btn-q${qId}`);
        if(gridBtn) gridBtn.classList.add("answered");
      });
    });
  }

  // --- 7. ĐỒNG HỒ ĐẾM NGƯỢC ---
  function startTimer(totalSeconds) {
    let timeLeft = totalSeconds; 
    const timerEl = document.getElementById("timer");
    
    clearInterval(timerId); // Xóa đồng hồ cũ tránh lỗi chạy nhanh
    timerId = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(timerId);
        timerEl.innerText = "00:00:00";
        submitQuiz(); // Hết giờ -> Tự động nộp
      } else {
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        timerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        timeLeft--;
      }
    }, 1000);
  }

  // --- 8. NỘP BÀI VÀ CHẤM ĐIỂM ---
  function submitQuiz() {
    clearInterval(timerId); 
    
    let correct = 0, wrong = 0, skipped = 0;
    const questions = currentQuizData.questions;

    // Tính thời gian đã dùng
    const timeTakenSecs = Math.floor((Date.now() - startTime) / 1000);
    const mTaken = Math.floor(timeTakenSecs / 60);
    const sTaken = timeTakenSecs % 60;

    // Duyệt qua từng câu để chấm
    questions.forEach(item => {
      const uAns = userAnswers[item.id];
      const correctAns = item.correctAnswer;

      // Đánh dấu đáp án đúng (Màu xanh) cho lúc xem lại
      const correctNode = document.getElementById(`opt-${item.id}-${correctAns}`);
      if(correctNode) correctNode.classList.add("correct-ans");

      if (!uAns) {
        skipped++;
      } else if (uAns === correctAns) {
        correct++;
      } else {
        wrong++;
        // Đánh dấu đáp án sai người dùng đã chọn (Màu đỏ)
        const wrongNode = document.getElementById(`opt-${item.id}-${uAns}`);
        if(wrongNode) wrongNode.classList.add("wrong-ans");
      }
    });

    // Quy ra thang điểm 10
    let score = (correct / questions.length) * 10;
    score = Number(score.toFixed(2)); 

    // Gắn dữ liệu vào màn hình kết quả
    document.getElementById("final-score").innerText = score;
    document.getElementById("final-status").innerText = score >= 5 ? "(Đạt)" : "(Không đạt)";
    document.getElementById("stat-correct").innerText = correct;
    document.getElementById("stat-incorrect").innerText = wrong;
    document.getElementById("stat-skipped").innerText = skipped;
    document.getElementById("time-taken-text").innerText = `${mTaken} phút ${sTaken} giây`;

    // Ẩn Quiz -> Hiện Kết quả
    quizContainer.classList.add("hidden");
    resultScreen.classList.remove("hidden");
  }

  // Lắng nghe sự kiện click nút "Nộp bài"
  if(btnSubmit) {
    btnSubmit.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn nộp bài không?")) {
        submitQuiz();
      }
    });
  }

  // --- 9. XỬ LÝ CÁC NÚT Ở MÀN HÌNH KẾT QUẢ ---
  
  // Nút Thi lại
  document.getElementById("btn-retry").addEventListener("click", () => {
    window.location.reload(); 
  });

  // Nút Xem xếp hạng (Đang phát triển)
  document.getElementById("btn-view-rank").addEventListener("click", () => {
    alert("Tính năng xếp hạng đang được phát triển!");
  });

  // Nút Xem lại Kết quả
  document.getElementById("btn-view-result").addEventListener("click", () => {
    resultScreen.classList.add("hidden");
    quizContainer.classList.remove("hidden");
    
    // Thêm class review-mode để chặn sửa đáp án và hiện màu Đúng/Sai
    document.querySelector(".main-content").classList.add("review-mode");
    
    // Đổi chức năng nút Nộp bài thành nút Trở về
    btnSubmit.innerText = "Trở về Trang chủ";
    btnSubmit.onclick = () => {
      // Nút Thi lại
  document.getElementById("btn-retry").addEventListener("click", () => {
    // Ẩn màn hình kết quả
    resultScreen.classList.add("hidden");
    
    // Bắt đầu lại bài thi hiện tại bằng hàm startSpecificQuiz
    startSpecificQuiz(currentQuizData.quizId); 
  });
    };
  });

  // --- 10. KHỞI CHẠY LẦN ĐẦU TÊN ---
  renderDashboard();
});