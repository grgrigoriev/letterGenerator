const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const profilePath = path.join(__dirname, "profile.txt");
let MY_PROFILE = "ОШИБКА: Файл profile.txt не найден.";

try {
    MY_PROFILE = fs.readFileSync(profilePath, "utf8");
} catch (err) {
    console.error("⚠️", err.message);
    process.exit(1);
}

async function extractTextFromPDF(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        return data.text.trim();
    } catch (err) {
        throw new Error("❌ Ошибка чтения PDF: " + err.message);
    }
}

async function generateCoverLetter(vacancyPDFPath) {
    console.log("\n📄 Чтение PDF вакансии...");
    const vacancyText = await extractTextFromPDF(vacancyPDFPath);
    
    if (!vacancyText || vacancyText.length < 100) {
        throw new Error("❌ Извлеченный текст слишком короткий или пустой.");
    }
    
    console.log("✅ Текст вакансии извлечен (" + vacancyText.length + " символов)");
    
    const prompt = "Ты опытный HR-специалист. Напиши сопроводительное письмо.\n\nКОНТЕКСТ ВАКАНСИИ:\n" + vacancyText.substring(0, 3000) + "\n\nПРОФИЛЬ:\n" + MY_PROFILE + "\n\nТРЕБОВАНИЯ: 1) Русский язык, деловой тон. 2) 150-250 слов. 3) Подчеркни опыт с AI-инструментами (Qwen CLI, LM Studio). 4) Упомяни опыт в Сбере (500+ релизов). 5) Не придумывай факты. 6) В конце: \"С уважением, Георгий Григорьев\".\n\nПисьмо:";

    console.log("🔄 Отправка в LM Studio...");
    
    try {
        const response = await fetch("http://localhost:1234/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "qwen/qwen3.8-27b",
                messages: [
                    { role: "system", content: "Пиши кратко, по делу, на русском." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 4000,
                stream: false
            })
        });

        if (response.status !== 200) {
            const errData = await response.json().catch(() => ({}));
            throw new Error("LM Studio API error: " + response.status + " " + (errData.error?.message || ""));
        }

        const data = await response.json();
        const generatedLetter = data.choices?.[0]?.message?.content || "⚠️ Пустой ответ";
        
        const outputDir = path.join(__dirname, "output");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const outputPath = path.join(outputDir, "cover_letter_" + timestamp + ".txt");
        
        fs.writeFileSync(outputPath, generatedLetter, "utf8");
        
        console.log("\n==================================================");
        console.log("🎉 ГОТОВОЕ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО:");
        console.log("==================================================");
        console.log(generatedLetter);
        console.log("==================================================\n");
        console.log("💾 Сохранено: " + outputPath);
        
        return { letter: generatedLetter, filePath: outputPath };
    } catch (error) {
        console.error("❌ Ошибка LM Studio:", error.message);
        throw error;
    }
}

if (require.main === module) {
    const vacancyPDFPath = process.argv[2];
    if (!vacancyPDFPath) {
        console.error("❌ Укажите путь к PDF");
        process.exit(1);
    }
    if (!fs.existsSync(vacancyPDFPath)) {
        console.error("❌ Файл не найден: " + vacancyPDFPath);
        process.exit(1);
    }
    generateCoverLetter(vacancyPDFPath)
        .then(() => process.exit(0))
        .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { generateCoverLetter };
