export type SupportedLanguage = "en" | "hi" | "ta";

export interface TranslationDictionary {
  appName: string;
  appSubtitle: string;
  appDescription: string;
  nav: {
    intake: string;
    analysis: string;
    compare: string;
    qa: string;
    export: string;
  };
  accessibility: {
    skipToContent: string;
    lowBandwidth: string;
    lowBandwidthActive: string;
    voiceDictate: string;
    voiceDictating: string;
    listenAloud: string;
    stopListening: string;
    language: string;
    audioNotSupported: string;
  };
  risks: {
    low: string;
    caution: string;
    high: string;
  };
  readingLevel: {
    plain: string;
    detailed: string;
  };
  consultation: {
    title: string;
    youAsked: string;
    documentSays: string;
    grounded: string;
    notCovered: string;
    addToLawyer: string;
    addedToLawyer: string;
    consultButton: string;
  };
  memo: {
    title: string;
    downloadPdf: string;
    print: string;
    copyText: string;
    actionsHeading: string;
    questionsHeading: string;
  };
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: "NyaySetu",
    appSubtitle: "Legal Access & Assistance",
    appDescription:
      "Demystifying complex legal agreements for tenants, gig workers, and small traders with grounded intelligence.",
    nav: {
      intake: "Intake Desk (F1)",
      analysis: "Split Analysis (F3)",
      compare: "Redline Compare (F4)",
      qa: "Consultation Q&A (F5)",
      export: "Memo & Export (F6)",
    },
    accessibility: {
      skipToContent: "Skip to main content",
      lowBandwidth: "Low-Bandwidth Mode",
      lowBandwidthActive: "Low-Bandwidth Active",
      voiceDictate: "Dictate inquiry via voice",
      voiceDictating: "Listening...",
      listenAloud: "Listen to summary",
      stopListening: "Stop audio",
      language: "Language",
      audioNotSupported: "Speech not supported on this browser",
    },
    risks: {
      low: "Standard Term",
      caution: "Caution Required",
      high: "High Legal Risk",
    },
    readingLevel: {
      plain: "Plain Language",
      detailed: "Detailed Legal Register",
    },
    consultation: {
      title: "Document Consultation Transcript",
      youAsked: "You Asked:",
      documentSays: "The Document Says:",
      grounded: "Document Grounded",
      notCovered: "Not Covered in Document",
      addToLawyer: "Add to Lawyer-Prep Checklist",
      addedToLawyer: "Added to Lawyer Checklist",
      consultButton: "Consult",
    },
    memo: {
      title: "Legal Preparation Memorandum",
      downloadPdf: "Download PDF",
      print: "Print Memo",
      copyText: "Copy Text",
      actionsHeading: "1. Executive Action Checklist (Before Signing)",
      questionsHeading: "2. Questions for Your Legal Advisor / Advocate",
    },
  },
  hi: {
    appName: "न्यायसेतु",
    appSubtitle: "कानूनी सहायता एवं पहुंच",
    appDescription:
      "किरायेदारों, गिग श्रमिकों और छोटे व्यापारियों के लिए कानूनी समझौतों को स्पष्ट और सरल बनाना।",
    nav: {
      intake: "दस्तावेज़ इंटेक (F1)",
      analysis: "विश्लेषण (F3)",
      compare: "तुलना मोड (F4)",
      qa: "परामर्श प्रश्नोत्तर (F5)",
      export: "मेमो एवं निर्यात (F6)",
    },
    accessibility: {
      skipToContent: "मुख्य सामग्री पर जाएं",
      lowBandwidth: "कम-बैंडविड्थ मोड",
      lowBandwidthActive: "कम-बैंडविड्थ सक्रिय",
      voiceDictate: "आवाज से प्रश्न पूछें",
      voiceDictating: "सुन रहे हैं...",
      listenAloud: "सारांश सुनें",
      stopListening: "ऑडियो रोकें",
      language: "भाषा",
      audioNotSupported: "इस ब्राउज़र में स्पीच समर्थित नहीं है",
    },
    risks: {
      low: "मानक शर्त",
      caution: "सावधानी आवश्यक",
      high: "उच्च कानूनी जोखिम",
    },
    readingLevel: {
      plain: "सरल भाषा",
      detailed: "विस्तृत कानूनी भाषा",
    },
    consultation: {
      title: "दस्तावेज़ परामर्श प्रतिलेख",
      youAsked: "आपका प्रश्न:",
      documentSays: "दस्तावेज़ के अनुसार:",
      grounded: "दस्तावेज़-आधारित",
      notCovered: "दस्तावेज़ में शामिल नहीं",
      addToLawyer: "वकील चेकलिस्ट में जोड़ें",
      addedToLawyer: "वकील चेकलिस्ट में जोड़ा गया",
      consultButton: "पूछें",
    },
    memo: {
      title: "कानूनी तैयारी ज्ञापन (मेमोरेंडम)",
      downloadPdf: "पीडीएफ डाउनलोड करें",
      print: "प्रिंट करें",
      copyText: "कॉपी करें",
      actionsHeading: "1. महत्वपूर्ण कार्य सूची (हस्ताक्षर से पूर्व)",
      questionsHeading: "2. कानूनी सलाहकार / वकील के लिए प्रश्न",
    },
  },
  ta: {
    appName: "நியாயசேது",
    appSubtitle: "சட்ட அணுகல் மற்றும் உதவி",
    appDescription:
      "குத்தகைதாரர்கள், தற்காலிகப் பணியாளர்கள் மற்றும் சிறு வணிகர்களுக்கான சட்ட ஆவணங்களை எளிமைப்படுத்துகிறது.",
    nav: {
      intake: "ஆவண உட்கொள்ளல் (F1)",
      analysis: "பகுப்பாய்வு (F3)",
      compare: "ஒப்பீடு (F4)",
      qa: "ஆலோசனை வினா-விடை (F5)",
      export: "மெமோ & ஏற்றுமதி (F6)",
    },
    accessibility: {
      skipToContent: "முதன்மை உள்ளடக்கத்திற்குச் செல்லவும்",
      lowBandwidth: "குறைந்த அலைவரிசை முறை",
      lowBandwidthActive: "குறைந்த அலைவரிசை இயங்குகிறது",
      voiceDictate: "குரல் மூலம் கேட்கவும்",
      voiceDictating: "கேட்கிறது...",
      listenAloud: "சுருக்கத்தைக் கேளுங்கள்",
      stopListening: "நிறுத்து",
      language: "மொழி",
      audioNotSupported: "இந்த உலாவியில் குரல் வசதி இல்லை",
    },
    risks: {
      low: "வழக்கமான விதி",
      caution: "கவனம் தேவை",
      high: "அதிக சட்ட ஆபத்து",
    },
    readingLevel: {
      plain: "எளிய மொழி",
      detailed: "விரிவான சட்ட மொழி",
    },
    consultation: {
      title: "ஆவண ஆலோசனைப் பதிவு",
      youAsked: "நீங்கள் கேட்டது:",
      documentSays: "ஆவணம் கூறுவது:",
      grounded: "ஆவண ஆதாரமுடையது",
      notCovered: "ஆவணத்தில் இல்லை",
      addToLawyer: "வக்கீல் பட்டியலில் சேர்க்க",
      addedToLawyer: "வக்கீல் பட்டியலில் சேர்க்கப்பட்டது",
      consultButton: "ஆலோசி",
    },
    memo: {
      title: "சட்ட தயாரிப்பு குறிப்பு (மெமோ)",
      downloadPdf: "PDF பதிவிறக்கம்",
      print: "அச்சிடுக",
      copyText: "நகலெடு",
      actionsHeading: "1. கையொப்பமிடுவதற்கு முன் சரிபார்ப்பு பட்டியல்",
      questionsHeading: "2. உங்கள் வழக்கறிஞரிடம் கேட்க வேண்டிய கேள்விகள்",
    },
  },
};
