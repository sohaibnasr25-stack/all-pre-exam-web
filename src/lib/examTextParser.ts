export interface ParsedChoice {
  letter: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
  source_document?: string;
  source_page?: string;
  source_reference?: string;
}

export interface ParsedQuestion {
  question_number?: number;
  question_text: string;
  clinical_vignette?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  subject_name?: string;
  chapter_name?: string;
  concept_name?: string;
  choices: ParsedChoice[];
}

export interface ParsedExamPayload {
  exam_title: string;
  academic_year_name?: string;
  module_name?: string;
  default_subject_name?: string;
  default_chapter_name?: string;
  default_concept_name?: string;
  exam_type?: 'end_module' | 'final';
  duration_minutes?: number;
  passing_score?: number;
  instructions?: string;
  questions: ParsedQuestion[];
  all_exams?: ParsedExamPayload[];
}

function normalizeDigits(str: string): string {
  return str.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const arabicToLatinLetter: Record<string, string> = {
  'أ': 'A',
  'ا': 'A',
  'ب': 'B',
  'ج': 'C',
  'د': 'D',
  'ه': 'E',
  'هـ': 'E',
};

const questionStartRegex = /^(?:(?:\[?(?:Question|سؤال|السؤال|س|Q)\s*(\d+)\]?[:.]?)|(?:\(?\s*(\d+)\s*[\.\)\:\-]\s*))/i;
const choiceRegex = /^\s*(\*?)\s*(?:\[\s*([A-Ea-e]|[أ-ي])\s*\]|\(\s*([A-Ea-e]|[أ-ي])\s*\)|[-*•]?\s*([A-Ea-e]|[أ-ي])\s*[\.\)\:\-])\s*(\*?)\s*(.*)/;
const explanationRegex = /^(?:[-*•]\s*)?(?:(?:Classification|Classifications|(?:ال)?تصنيف(?:ات)?)\s*[:=—–\-]\s*)?(?:Explanation|Exp|التفسير|تفسير|الشرح|شرح)(?:\s*\(([A-Ea-e]|[أ-ي])\))?\s*[:=—–\-]?\s*(.*)$/i;
const sourceRegex = /^(?:[-*•]\s*)?(?:Reference|Ref|Source|Book|المرجع|المصدر|الكتاب)(?:\s*\(([A-Ea-e]|[أ-ي])\))?\s*[:=—–\-]?\s*(.*)$/i;
const pageRegex = /^(?:[-*•]\s*)?(?:Page|Pages|Pg|Pgs|pp\.|pp|p\.|الصفحة|صفحة|ص)(?:\s*\(([A-Ea-e]|[أ-ي])\))?\s*[:=—–\-]?\s*(.*)$/i;

function splitMultiExamChunks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let questionsFoundInCurrent = false;

  const examHeaderRegex = /^(?:(?:={3,}|-{3,})|(?:Exam(?:\s*Title)?|اسم الامتحان|عنوان الامتحان|الامتحان)\s*[:=])/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = normalizeDigits(rawLine.trim());

    if (!line) {
      if (currentChunk.length > 0) currentChunk.push('');
      continue;
    }

    if (questionStartRegex.test(line)) {
      questionsFoundInCurrent = true;
    }

    if (questionsFoundInCurrent && examHeaderRegex.test(line)) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        questionsFoundInCurrent = false;
      }
    }

    currentChunk.push(rawLine);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks.length > 1 ? chunks : [text];
}

function distributeChoiceExplanations(choicesList: ParsedChoice[]): void {
  // Check if one choice holds a combined block while other choices are empty or have only "Correct:"/"Incorrect:"
  const bigExpChoice = choicesList.find(
    (c) =>
      c.explanation &&
      c.explanation.length > 80 &&
      choicesList.filter(
        (o) =>
          !o.explanation ||
          /^(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]?$/i.test(o.explanation.trim())
      ).length >= 2
  );

  if (bigExpChoice && bigExpChoice.explanation) {
    const rawText = bigExpChoice.explanation;
    // Split into sentences / paragraphs
    const sentences = rawText
      .split(/(?<=\.)\s+(?=[A-Z]|Incorrect:|Correct:|صحيح|غير صحيح|خطأ)/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const assigned: Record<string, string> = {};
    for (const choice of choicesList) {
      const choiceKeywords = choice.text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);
      let bestSentence = '';
      let bestScore = 0;

      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        const sLower = s.toLowerCase();
        let score = 0;
        for (const kw of choiceKeywords) {
          if (sLower.includes(kw)) score += 2;
        }
        if (
          sLower.includes(`(${choice.letter.toLowerCase()})`) ||
          sLower.includes(`choice ${choice.letter.toLowerCase()}`) ||
          sLower.includes(`option ${choice.letter.toLowerCase()}`)
        ) {
          score += 5;
        }
        if (score > bestScore) {
          bestScore = score;
          bestSentence = s;
        }
      }

      if (bestSentence && bestScore > 0) {
        assigned[choice.letter] = bestSentence
          .replace(/^(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]\s*/i, '')
          .trim();
      }
    }

    if (Object.keys(assigned).length === choicesList.length) {
      for (const c of choicesList) {
        c.explanation = assigned[c.letter];
      }
    } else if (sentences.length === choicesList.length) {
      choicesList.forEach((c, idx) => {
        c.explanation = sentences[idx]
          .replace(/^(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]\s*/i, '')
          .trim();
      });
    }
  }

  // Clean redundant leading labels like "Correct: " or "Incorrect: " across all choices
  for (const c of choicesList) {
    if (c.explanation) {
      c.explanation = c.explanation
        .replace(/^(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]\s*/i, '')
        .trim();
    }
  }
}

/**
 * Intelligent text parser for exams in .txt format (Arabic & English supported)
 * Pure function: Safe for both Client Component browser usage and Server-side execution.
 */
export function parseBulkExamText(rawText: string): ParsedExamPayload {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return {
          exam_title: parsed.exam_title || parsed.title || 'Imported Exam',
          academic_year_name: parsed.academic_year_name || parsed.year_name,
          module_name: parsed.module_name,
          default_subject_name: parsed.default_subject_name || parsed.subject_name,
          default_chapter_name: parsed.default_chapter_name || parsed.chapter_name,
          default_concept_name: parsed.default_concept_name || parsed.concept_name,
          exam_type: parsed.exam_type === 'end_module' ? 'end_module' : 'final',
          duration_minutes: parsed.duration_minutes || 60,
          passing_score: parsed.passing_score || 70,
          instructions: parsed.instructions,
          questions: parsed.questions.map((q: any, idx: number) => ({
            question_number: idx + 1,
            question_text: q.question_text || q.text || `Question ${idx + 1}`,
            clinical_vignette: q.clinical_vignette || q.vignette,
            subject_name: q.subject_name,
            chapter_name: q.chapter_name,
            concept_name: q.concept_name,
            choices: (q.choices || q.answer_choices || []).map((c: any, cIdx: number) => ({
              letter: c.letter || c.choice_letter || String.fromCharCode(65 + cIdx),
              text: c.text || c.choice_text || '',
              is_correct: !!c.is_correct,
              explanation: c.explanation || c.explanation_text,
              source_document: c.source_document || c.source,
              source_page: c.source_page || c.page,
              source_reference: c.source_reference || c.reference,
            })),
          })),
        };
      }
    } catch {
      // Not JSON, continue to text parser
    }
  }

  const chunks = splitMultiExamChunks(rawText);
  if (chunks.length > 1) {
    const parsedExams = chunks.map((chunk) => parseSingleExam(chunk)).filter((e) => e.questions.length > 0);
    if (parsedExams.length > 1) {
      const allQuestions: ParsedQuestion[] = [];
      parsedExams.forEach((e) => allQuestions.push(...e.questions));
      return {
        exam_title: `${parsedExams.length} Exams (${parsedExams.map((e) => e.exam_title).join(' • ')})`,
        academic_year_name: parsedExams[0]?.academic_year_name,
        module_name: parsedExams[0]?.module_name,
        default_subject_name: parsedExams[0]?.default_subject_name,
        default_chapter_name: parsedExams[0]?.default_chapter_name,
        default_concept_name: parsedExams[0]?.default_concept_name,
        exam_type: parsedExams[0]?.exam_type,
        duration_minutes: parsedExams[0]?.duration_minutes,
        passing_score: parsedExams[0]?.passing_score,
        questions: allQuestions,
        all_exams: parsedExams,
      };
    }
  }

  return parseSingleExam(rawText);
}

export function parseSingleExam(rawText: string): ParsedExamPayload {
  const lines = rawText.split(/\r?\n/);

  let exam_title = 'Imported Examination';
  let academic_year_name = '';
  let module_name = '';
  let default_subject_name = '';
  let default_chapter_name = '';
  let default_concept_name = '';
  let duration_minutes = 60;
  let passing_score = 70;
  let exam_type: 'end_module' | 'final' = 'final';

  const rawQuestionsBlocks: string[][] = [];
  let currentQBlock: string[] = [];
  let inQuestionsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = normalizeDigits(rawLine.trim());
    if (!line) {
      if (inQuestionsSection && currentQBlock.length > 0) {
        currentQBlock.push('');
      }
      continue;
    }

    // Header metadata extraction before questions
    if (!inQuestionsSection) {
      const lower = line.toLowerCase();
      if (lower.startsWith('exam:') || lower.startsWith('exam title:') || line.startsWith('الامتحان:') || line.startsWith('اسم الامتحان:')) {
        exam_title = line.substring(line.indexOf(':') + 1).trim() || exam_title;
        continue;
      }
      if (lower.startsWith('type:') || lower.startsWith('exam type:') || line.startsWith('نوع الامتحان:') || line.startsWith('النوع:')) {
        const typeVal = line.substring(line.indexOf(':') + 1).toLowerCase().trim();
        if (typeVal.includes('end') || typeVal.includes('module') || typeVal.includes('موديول')) {
          exam_type = 'end_module';
        } else {
          exam_type = 'final';
        }
        continue;
      }
      if (lower.startsWith('year:') || lower.startsWith('academic year:') || line.startsWith('العام:') || line.startsWith('العام الأكاديمي:') || line.startsWith('السنة:')) {
        academic_year_name = line.substring(line.indexOf(':') + 1).trim();
        continue;
      }
      if (lower.startsWith('module:') || line.startsWith('الموديول:')) {
        module_name = line.substring(line.indexOf(':') + 1).trim();
        continue;
      }
      if (lower.startsWith('subject:') || line.startsWith('المادة:')) {
        default_subject_name = line.substring(line.indexOf(':') + 1).trim();
        continue;
      }
      if (lower.startsWith('chapter:') || line.startsWith('الشابتر:') || line.startsWith('الفصل:')) {
        default_chapter_name = line.substring(line.indexOf(':') + 1).trim();
        continue;
      }
      if (lower.startsWith('concept:') || line.startsWith('المفهوم:') || line.startsWith('الموضوع:')) {
        default_concept_name = line.substring(line.indexOf(':') + 1).trim();
        continue;
      }
      if (lower.startsWith('duration:') || line.startsWith('المدة:') || line.startsWith('الوقت:')) {
        const val = parseInt(line.substring(line.indexOf(':') + 1).replace(/\D/g, ''), 10);
        if (!isNaN(val)) duration_minutes = val;
        continue;
      }
      if (lower.startsWith('passing score:') || line.startsWith('درجة النجاح:')) {
        const val = parseInt(line.substring(line.indexOf(':') + 1).replace(/\D/g, ''), 10);
        if (!isNaN(val)) passing_score = val;
        continue;
      }
    }

    // Check if this line marks the beginning of a new question
    if (questionStartRegex.test(line) || (line.startsWith('[') && line.toLowerCase().includes('question'))) {
      inQuestionsSection = true;
      if (currentQBlock.length > 0) {
        rawQuestionsBlocks.push([...currentQBlock]);
        currentQBlock = [];
      }
      currentQBlock.push(line);
      continue;
    }

    if (inQuestionsSection) {
      currentQBlock.push(line);
    }
  }

  if (currentQBlock.length > 0) {
    rawQuestionsBlocks.push(currentQBlock);
  }

  // Parse each individual question block
  const questions: ParsedQuestion[] = rawQuestionsBlocks.map((block, qIdx) => {
    let qNumber = qIdx + 1;
    let vignette = '';
    let qText = '';
    let qSubject = '';
    let qChapter = '';
    let qConcept = '';
    let explicitAnswerLetters: string[] | null = null;

    const choices: ParsedChoice[] = [];
    let currentChoice: ParsedChoice | null = null;
    let activeTargetChoice: ParsedChoice | null = null;
    let lastTargetField: 'text' | 'explanation' | 'source' = 'text';

    const flushCurrentChoice = () => {
      if (currentChoice) {
        let text = currentChoice.text.trim();
        let explanation = currentChoice.explanation?.trim() || '';

        // Extract any embedded explanation/classification from choice text
        const explMatch = text.match(/(?:Classification:\s*)?(Explanation(?:\s*\([A-Ea-e]\))?\s*[—–\-:].*)$/i);
        if (explMatch) {
          explanation = (explanation ? explanation + ' ' : '') + explMatch[1].trim();
          text = text.substring(0, explMatch.index).trim();
        } else if (/(?:Classification|Classifications|(?:ال)?تصنيف(?:ات)?)\s*[:=—–\-]/i.test(text)) {
          const classIdx = text.search(/(?:Classification|Classifications|(?:ال)?تصنيف(?:ات)?)\s*[:=—–\-]/i);
          text = text.substring(0, classIdx).trim();
        }

        // Extract any inline sub-choice like " - C. In renal..." or " - D. Niacin"
        const subChoiceMatch = text.match(/\s+[-–—]\s+([A-Ea-e])\.\s+(.*)$/);
        let subChoice: ParsedChoice | null = null;
        if (subChoiceMatch) {
          const subLetter = (arabicToLatinLetter[subChoiceMatch[1]] || subChoiceMatch[1]).toUpperCase();
          const subText = subChoiceMatch[2].trim();
          text = text.substring(0, subChoiceMatch.index).trim();
          subChoice = { letter: subLetter, text: subText, is_correct: false };
        }

        currentChoice.text = text;
        currentChoice.explanation = explanation || undefined;
        choices.push({ ...currentChoice });
        if (subChoice) {
          choices.push(subChoice);
        }
        currentChoice = null;
      }
    };

    const flushIfTargetDiffers = (targetLetter?: string) => {
      if (currentChoice && targetLetter) {
        const normalized = (arabicToLatinLetter[targetLetter] || targetLetter).toUpperCase();
        if (currentChoice.letter.toUpperCase() !== normalized) {
          flushCurrentChoice();
        }
      }
    };

    const findTargetChoice = (letter?: string): ParsedChoice | null => {
      if (letter) {
        const normalized = (arabicToLatinLetter[letter] || letter).toUpperCase();
        if (currentChoice && currentChoice.letter.toUpperCase() === normalized) {
          return currentChoice;
        }
        return choices.find((c) => c.letter.toUpperCase() === normalized) || null;
      }
      if (currentChoice) return currentChoice;
      if (activeTargetChoice) return activeTargetChoice;
      return choices.find((c) => c.is_correct) || (choices.length > 0 ? choices[choices.length - 1] : null);
    };

    for (let l = 0; l < block.length; l++) {
      const rawL = block[l].trim();
      if (!rawL) continue;

      // Extract question number from first line if present
      if (l === 0 && questionStartRegex.test(rawL)) {
        const match = rawL.match(questionStartRegex);
        if (match) {
          const num = match[1] || match[2];
          if (num) qNumber = parseInt(num, 10);
          const remaining = rawL.replace(questionStartRegex, '').trim();
          if (remaining) {
            qText += remaining + ' ';
          }
          continue;
        }
      }

      // Check section headers like "Classification:" or "التصنيف:" alone
      if (/^(?:[-*•]\s*)?(?:Classification|Classifications|(?:ال)?تصنيف(?:ات)?)\s*[:=—–\-]?$/i.test(rawL)) {
        flushCurrentChoice();
        activeTargetChoice = null;
        lastTargetField = 'text';
        continue;
      }

      // Check metadata tags
      const lower = rawL.toLowerCase();
      if (lower.startsWith('vignette:') || lower.startsWith('clinical vignette:') || rawL.startsWith('الحالة:') || rawL.startsWith('الحالة السريرية:')) {
        flushCurrentChoice();
        vignette = rawL.substring(rawL.indexOf(':') + 1).trim();
        activeTargetChoice = null;
        continue;
      }
      if (lower.startsWith('question:') || rawL.startsWith('السؤال:') || rawL.startsWith('نص السؤال:')) {
        flushCurrentChoice();
        qText = rawL.substring(rawL.indexOf(':') + 1).trim();
        activeTargetChoice = null;
        continue;
      }
      if (lower.startsWith('difficulty:') || rawL.startsWith('الصعوبة:')) {
        flushCurrentChoice();
        activeTargetChoice = null;
        continue;
      }
      if (lower.startsWith('subject:') || rawL.startsWith('المادة:')) {
        flushCurrentChoice();
        qSubject = rawL.substring(rawL.indexOf(':') + 1).trim();
        activeTargetChoice = null;
        continue;
      }
      if (lower.startsWith('chapter:') || rawL.startsWith('الشابتر:') || rawL.startsWith('الفصل:')) {
        flushCurrentChoice();
        qChapter = rawL.substring(rawL.indexOf(':') + 1).trim();
        activeTargetChoice = null;
        continue;
      }
      if (lower.startsWith('concept:') || rawL.startsWith('المفهوم:') || rawL.startsWith('الموضوع:')) {
        flushCurrentChoice();
        qConcept = rawL.substring(rawL.indexOf(':') + 1).trim();
        activeTargetChoice = null;
        continue;
      }

      // Check explicit answer line (e.g. "Answer: B", "Ans: C, D", "Key: D", "الإجابة: A, B")
      const answerRegex = /^(?:Answer|Ans|Key|Correct(?:\s+Answer)?|الجواب|الإجابة|الإجابة\s+الصحيحة)\s*[:=\-]\s*(.*)$/i;
      const ansMatch = rawL.match(answerRegex);
      if (ansMatch) {
        flushCurrentChoice();
        const rawAns = ansMatch[1].trim();
        const letterMatches = rawAns.match(/[A-Ea-eأ-ي]/g);
        if (letterMatches && letterMatches.length > 0) {
          explicitAnswerLetters = letterMatches.map((l) => (arabicToLatinLetter[l] || l).toUpperCase());
          activeTargetChoice = findTargetChoice(explicitAnswerLetters[0]);
        }
        continue;
      }

      // Check if line is a choice (A, B, C, D, E or Arabic letters)
      const choiceMatch = rawL.match(choiceRegex);
      if (choiceMatch) {
        flushCurrentChoice();
        const rawLetter = choiceMatch[2] || choiceMatch[3] || choiceMatch[4];
        const letter = (arabicToLatinLetter[rawLetter] || rawLetter).toUpperCase();
        const isStarred = choiceMatch[1] === '*' || choiceMatch[5] === '*';
        let choiceContent = choiceMatch[6].trim();

        // Check for indicators in the choice text like "(Correct)" or "(الإجابة الصحيحة)"
        let isCorrect = isStarred;
        const correctMarkers = ['(correct)', '[correct]', '(صح)', '(صحيحة)', '(الإجابة الصحيحة)', '[x]', '✓'];
        for (const marker of correctMarkers) {
          if (choiceContent.toLowerCase().includes(marker.toLowerCase())) {
            isCorrect = true;
            choiceContent = choiceContent.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
          }
        }

        currentChoice = {
          letter,
          text: choiceContent,
          is_correct: isCorrect,
        };
        activeTargetChoice = currentChoice;
        lastTargetField = 'text';
        continue;
      }

      // Explanation regex check (e.g. "Explanation (A) - Correct:", "Explanation (B): ...", "Explanation: ...", "الشرح: ...")
      const explMatch = rawL.match(explanationRegex);
      if (explMatch) {
        const targetLetter = explMatch[1];
        flushIfTargetDiffers(targetLetter);
        const explRawText = explMatch[2].trim();
        const target: ParsedChoice | null = findTargetChoice(targetLetter);

        if (target) {
          const isExplicitCorrect = /^(?:[-—–\s]*)(?:Correct|صحيح|الإجابة\s*الصحيحة)(?:[:\s—–\-]|$)/i.test(explRawText);
          const isExplicitIncorrect = /^(?:[-—–\s]*)(?:Incorrect|غير\s*صحيح|خطأ)(?:[:\s—–\-]|$)/i.test(explRawText);

          if (isExplicitCorrect) {
            target.is_correct = true;
          } else if (isExplicitIncorrect) {
            target.is_correct = false;
          }

          const isOnlyStatusLabel = /^(?:[-—–\s]*)(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]?$/i.test(explRawText);
          let explContent = '';
          if (!isOnlyStatusLabel) {
            explContent = explRawText
              .replace(/^(?:[-—–\s]*)(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]\s*/i, '')
              .trim();
          }

          if (explContent) {
            target.explanation = (target.explanation ? target.explanation + ' ' : '') + explContent;
          }

          activeTargetChoice = target;
          lastTargetField = 'explanation';
        }
        continue;
      }

      // Source/Reference regex check (e.g. "Reference (B): Robbins, Page 540", "Source: Guyton, p. 115")
      const srcMatch = rawL.match(sourceRegex);
      if (srcMatch) {
        const targetLetter = srcMatch[1];
        flushIfTargetDiffers(targetLetter);
        const srcText = srcMatch[2].trim();
        const target: ParsedChoice | null = findTargetChoice(targetLetter) || activeTargetChoice;

        // Auto-extract page number if embedded (e.g. ", Page 540" or "pp. 104-105" or "p. 115" or "ص 115")
        const pageInsideMatch = srcText.match(/(?:,\s*|\s+)(?:page|pages|pg|pgs|pp\.|pp|p\.|صفحة|صفحات|ص)[\s\:\.]*(\d+[\-\d]*)/i);
        const extractedPage = pageInsideMatch ? pageInsideMatch[1] : '';

        if (target) {
          target.source_document = srcText;
          if (extractedPage && !target.source_page) {
            target.source_page = extractedPage;
          }
          activeTargetChoice = target;
          lastTargetField = 'source';
        }
        continue;
      }

      // Page regex check (e.g. "Page: 540", "ص: 540")
      const pgMatch = rawL.match(pageRegex);
      if (pgMatch) {
        const targetLetter = pgMatch[1];
        flushIfTargetDiffers(targetLetter);
        const pageText = pgMatch[2].trim();
        const target: ParsedChoice | null = findTargetChoice(targetLetter) || activeTargetChoice;
        if (target) {
          target.source_page = pageText;
          activeTargetChoice = target;
        }
        continue;
      }

      // Continuation lines for active choice explanation
      if (lastTargetField === 'explanation' && activeTargetChoice) {
        activeTargetChoice.explanation = (activeTargetChoice.explanation ? activeTargetChoice.explanation + ' ' : '') + rawL;
        continue;
      }

      // Continuation lines for active source / reference
      if (lastTargetField === 'source' && activeTargetChoice) {
        activeTargetChoice.source_document = (activeTargetChoice.source_document ? activeTargetChoice.source_document + ' ' : '') + rawL;
        const pageInsideMatch = rawL.match(/(?:,\s*|\s+)(?:page|pages|pg|pgs|pp\.|pp|p\.|صفحة|صفحات|ص)[\s\:\.]*(\d+[\-\d]*)/i);
        if (pageInsideMatch && !activeTargetChoice.source_page) {
          activeTargetChoice.source_page = pageInsideMatch[1];
        }
        continue;
      }

      // Continuation lines for active choice text
      if (currentChoice && lastTargetField === 'text') {
        currentChoice.text += ' ' + rawL;
        continue;
      }

      // Part of question text or vignette
      if (!vignette && (rawL.toLowerCase().startsWith('patient') || (rawL.length > 80 && !qText))) {
        vignette = rawL;
      } else {
        qText += (qText ? ' ' : '') + rawL;
      }
    }

    flushCurrentChoice();

    // Check if Question stem has " - A. <Choice text>"
    const stemMatch = qText.match(/\s+[-–—]\s+A\.\s+(.*)$/i);
    if (stemMatch) {
      const aText = stemMatch[1].trim();
      qText = qText.substring(0, stemMatch.index).trim();
      choices.unshift({ letter: 'A', text: aText, is_correct: false });
    }

    // Sort choices alphabetically by letter
    choices.sort((a, b) => a.letter.localeCompare(b.letter));

    // Resolve choice correctness
    if (explicitAnswerLetters && explicitAnswerLetters.length > 0) {
      choices.forEach((c) => {
        c.is_correct = explicitAnswerLetters!.includes(c.letter);
      });
    } else {
      const confirmedCorrect = choices.filter((c) => c.is_correct);
      if (confirmedCorrect.length > 0) {
        const correctLetters = confirmedCorrect.map((c) => c.letter);
        choices.forEach((c) => {
          c.is_correct = correctLetters.includes(c.letter);
        });
      } else {
        if (choices.length > 0) choices[0].is_correct = true;
      }
    }

    // Clean redundant leading labels like "Correct: " or "Incorrect: " (requiring colon/dash)
    for (const c of choices) {
      if (c.explanation) {
        c.explanation = c.explanation
          .replace(/^(?:Correct|Incorrect|صحيح|غير\s*صحيح|خطأ)\s*[:—–\-]\s*/i, '')
          .trim();
      }
    }

    if (choices.length === 0) {
      choices.push(
        { letter: 'A', text: 'Option A', is_correct: true },
        { letter: 'B', text: 'Option B', is_correct: false },
        { letter: 'C', text: 'Option C', is_correct: false },
        { letter: 'D', text: 'Option D', is_correct: false }
      );
    } else {
      if (!choices.some((c) => c.is_correct)) {
        // Fallback: pick candidate that does NOT have "Incorrect" flag in explanation or is_correct === false
        const safeCandidate = choices.find(
          (c) =>
            c.is_correct !== false &&
            (!c.explanation || !/^(?:Incorrect|غير\s*صحيح|خطأ)|Explanation\s*\([A-Ea-eأ-ي]\)\s*[—–\-:]\s*(?:Incorrect|غير\s*صحيح|خطأ)/i.test(c.explanation.trim()))
        );
        if (safeCandidate) {
          safeCandidate.is_correct = true;
        } else {
          choices[0].is_correct = true;
        }
      }
    }

    // Distribute multi-choice explanations & clean up redundant markers
    distributeChoiceExplanations(choices);

    return {
      question_number: qNumber,
      question_text: qText || `Question ${qNumber}`,
      clinical_vignette: vignette || undefined,
      subject_name: qSubject || default_subject_name || undefined,
      chapter_name: qChapter || default_chapter_name || undefined,
      concept_name: qConcept || default_concept_name || undefined,
      choices,
    };
  });

  return {
    exam_title,
    academic_year_name: academic_year_name || undefined,
    module_name: module_name || undefined,
    default_subject_name: default_subject_name || undefined,
    default_chapter_name: default_chapter_name || undefined,
    default_concept_name: default_concept_name || undefined,
    exam_type,
    duration_minutes,
    passing_score,
    questions,
  };
}
