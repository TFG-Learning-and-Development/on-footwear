/** Learner-facing Nike Winflo 12 quick course content. */
export interface TableColumn { key: string; label: string }
export type TableRow = Record<string, string>;

export const courseData = {
  meta: { title: "Content", description: "Nike Winflo 12 quick course for helping Customers find everyday comfort." },
  brand: { label: "Nike Winflo 12", homeLabel: "Go to the Nike Winflo 12 course overview" },
  navigation: [
    { id: "lesson-1", label: "Welcome" },
    { id: "lesson-2", label: "Product basics" },
    { id: "lesson-3", label: "Shoe technology" },
    { id: "lesson-4", label: "Customer fit" },
    { id: "lesson-5", label: "What’s new" },
    { id: "lesson-6", label: "Key selling message" },
    { id: "lesson-7", label: "Customer scenario" },
    { id: "lesson-8", label: "Practice knowledge check" },
  ],
  hero: {
    title: "Welcome to Nike Winflo 12",
    paragraphs: [
      "Every Customer is looking for something different. Some want a fast shoe for race day, while others want comfort for easy runs, walks and everyday movement.",
      "The Nike Winflo 12 is a men’s road-running shoe made for Customers who want soft cushioning, a balanced feel underfoot and a comfortable fit. In this course, you will learn who the shoe is best for, how to explain its benefits simply and how to recommend it with confidence.",
    ],
  },
  customerMoment: {
    quote: "I am looking for a comfortable shoe for my easy runs and daily walks. I do not need a race shoe. I just want cushioning that feels good.",
    clue: "This is a good clue that the Nike Winflo 12 may be the right shoe.",
    explanation: "This Customer is not looking for speed or a race-day shoe. They want something comfortable for everyday runs and walks. The Nike Winflo 12 is a good option because it offers soft cushioning, a stable feel and a comfortable fit.",
  },
  journey: "You will first get to know this men’s road-running shoe and its main benefits. Then you will learn who it is best for, what is new and how to recommend it during a Customer conversation. Let’s get started.",
  basics: {
    intro: "Let’s start with the basics. As you work through this lesson, think about the Customer who wants one comfortable shoe for everyday runs and walks.",
    description: "The Nike Winflo 12 is made for Customers who want comfort during easy runs, walks and everyday activities. It has soft cushioning, a broad platform that helps the foot feel balanced and secure, and a comfortable fit. Customers may describe this need by saying they want a shoe that feels steady, supportive or less wobbly underfoot.",
    phrase: "The Nike Winflo 12 gives you soft cushioning, a balanced feel underfoot and a comfortable fit for your everyday runs and walks.",
  },
  technology: {
    intro: "Now let’s look at the features inside the shoe. As you explore each one, ask yourself: How does this help the Customer? Keep your explanation simple. Tell the Customer what the feature does, how it helps and why it matters to them.",
    features: [
      { title: "Cushlon 3.0 foam", image: "/assets/winflo-upper.webp", imageAlt: "Close view of the Nike Winflo 12 upper and cushioned sole", fields: [
        { label: "What it means", text: "Soft foam under the foot." }, { label: "Customer benefit", text: "Helps the Customer feel cushioned and comfortable." }, { label: "Say it like this", text: "The soft cushioning helps keep you comfortable during everyday runs." },
      ] },
      { title: "Nike Air unit", image: "/assets/winflo-air.webp", imageAlt: "Close view of the Nike Air unit in the Winflo 12 heel", fields: [
        { label: "What it means", text: "Extra cushioning is built into the shoe." }, { label: "Customer benefit", text: "Adds cushioning when the foot lands." }, { label: "Say it like this", text: "The Nike Air unit gives you extra cushioning when your foot lands." },
      ] },
      { title: "Open-hole mesh upper", image: "/assets/winflo-upper.webp", imageAlt: "Breathable mesh on the Nike Winflo 12 upper", fields: [
        { label: "What it means", text: "Breathable material on the top of the shoe." }, { label: "Customer benefit", text: "Allows air to move through the shoe." }, { label: "Say it like this", text: "The breathable upper helps your feet feel comfortable while you move." },
      ] },
      { title: "Accommodating fit", image: "/assets/winflo-top.webp", imageAlt: "Top view of the roomy Nike Winflo 12 shoes", fields: [
        { label: "What it means", text: "The shoe is designed to give the foot more room." }, { label: "Customer benefit", text: "Helps the shoe feel comfortable and secure." }, { label: "Say it like this", text: "The fit feels comfortable and secure without feeling too tight." },
      ] },
      { title: "Broad, stable platform", image: "/assets/winflo-side.webp", imageAlt: "Side profile showing the broad sole of the Nike Winflo 12", fields: [
        { label: "What it means", text: "A wider base under the foot." }, { label: "Customer benefit", text: "Helps the shoe feel stable and balanced." }, { label: "Say it like this", text: "The wider base helps you feel stable and secure as you move." },
      ] },
      { title: "10 mm heel-to-toe drop", image: "/assets/winflo-side.webp", imageAlt: "Side profile of the Nike Winflo 12 heel and forefoot", fields: [
        { label: "What it means", text: "There is a 10 mm height difference from the heel to the front of the shoe." }, { label: "Customer benefit", text: "Gives many runners a familiar feel underfoot." }, { label: "Say it like this", text: "The 10 mm drop gives the shoe a familiar everyday running feel." },
      ] },
    ],
    tip: "You do not need to explain every feature. Ask what the Customer needs, then focus on the one or two benefits that matter most to them.",
  },
  fit: {
    intro: "Start with the Customer, not the shoe. Ask how they plan to use it, then decide whether the Winflo 12 matches their needs. It is a good option when comfort matters most for everyday runs, walking or general use.",
    examples: [
      { title: "Easy, everyday road runs", image: "/assets/winflo-top.webp", imageAlt: "Top view of a pair of Nike Winflo 12 running shoes", fields: [{ label: "Why the Winflo 12 may fit", text: "Soft cushioning helps the Customer feel comfortable on everyday runs." }, { label: "Simple recommendation cue", text: "Recommend it when comfort is the main goal." }] },
      { title: "Long, relaxed runs", image: "/assets/winflo-side.webp", imageAlt: "Side profile of the cushioned Nike Winflo 12", fields: [{ label: "Why the Winflo 12 may fit", text: "The cushioning and stable feel work well for a relaxed pace." }, { label: "Simple recommendation cue", text: "Recommend it for a comfortable, easy pace." }] },
      { title: "A first running shoe", image: "/assets/winflo-pair.webp", imageAlt: "Pair of Nike Winflo 12 road-running shoes", fields: [{ label: "Why the Winflo 12 may fit", text: "It is a dependable daily trainer with cushioning and support." }, { label: "Simple recommendation cue", text: "Recommend it when the Customer wants a dependable daily trainer." }] },
      { title: "Walking or all-day comfort", image: "/assets/winflo-upper.webp", imageAlt: "Close view of the Nike Winflo 12 cushioned upper", fields: [{ label: "Why the Winflo 12 may fit", text: "The cushioning supports walking and time spent on your feet." }, { label: "Simple recommendation cue", text: "Recommend it when comfort matters across the day." }] },
      { title: "General gym use", image: "/assets/winflo-air.webp", imageAlt: "Nike Winflo 12 sole and heel detail", fields: [{ label: "Why the Winflo 12 may fit", text: "The shoe can support general gym use and light treadmill running." }, { label: "Simple recommendation cue", text: "Recommend it for general use, not speed-focused sessions." }] },
    ],
    unsuitable: ["Fast intervals or speed sessions", "Tempo runs where the Customer wants a light, quick feel", "Race day performance", "A Customer who prioritises a lightweight, agile shoe"],
    honest: "If the Customer wants speed or a race-day shoe, be honest that the Winflo 12 is made for comfortable everyday running. Then help them find a lighter performance shoe that better suits their goal.",
  },
  updates: {
    intro: "A Customer who knows the Winflo 11 may ask what has changed. Use these three updates to explain what is new in a simple way.",
    cards: [
      { title: "Increased Cushlon 3.0 foam stack height", benefit: "More foam underfoot for extra cushioning.", image: "/assets/winflo-side.webp", imageAlt: "Winflo 12 side view showing the Cushlon midsole" },
      { title: "Accommodating fit", benefit: "More room for a comfortable fit.", image: "/assets/winflo-upper.webp", imageAlt: "Winflo 12 upper and lacing detail" },
      { title: "Open-hole mesh upper", benefit: "More airflow through the top of the shoe.", image: "/assets/winflo-air.webp", imageAlt: "Winflo 12 mesh and heel detail" },
    ],
    specifications: [
      { detail: "Product type", specification: "Men’s road-running shoe" }, { detail: "Style code", specification: "HV9272" },
      { detail: "Weight", specification: "Approximately 322 g / 11.37 oz in a men’s US size 10" }, { detail: "Heel-to-toe drop", specification: "10 mm" },
    ],
    tip: "Only share the weight and heel-to-toe drop if the Customer asks. Most of the time, focus on comfort, cushioning, fit and how they plan to use the shoe.",
  },
  amer: {
    intro: "You now know what the shoe offers and who it is best for. Next, use A-M-E-R to guide the conversation. Ask a question, listen to the Customer and recommend the shoe based on what they tell you.",
    steps: [
      { name: "Ask", description: "Ask how the Customer plans to use the shoe.", example: "What type of running or activity will you use the shoe for?" },
      { name: "Match", description: "Link the Customer’s need to the right feature.", example: "You said comfort matters most, so I would look at the Cushlon 3.0 cushioning." },
      { name: "Explain", description: "Explain how the feature helps the Customer.", example: "It gives you a soft, cushioned feel for everyday runs." },
      { name: "Recommend", description: "Recommend the shoe and explain why it matches their needs.", example: "Based on what you have told me, I recommend trying the Nike Winflo 12." },
    ],
  },
  scenario: {
    intro: "Read what the Customer says below. Before you look at the example, think about what you would ask, which benefit you would focus on and how you would recommend the shoe.",
    quote: "I am new to running. I mostly do easy 5 km runs and I also walk a lot. I want something comfortable, not a fast race shoe.",
    explanation: "A-M-E-R stands for Ask, Match, Explain and Recommend. It helps you keep the conversation simple. First, ask how the Customer will use the shoe. Then match their needs to the right benefit, explain how it helps and recommend the shoe if it is a good fit. This helps you make a useful recommendation based on what the Customer needs.",
    response: [
      { name: "Ask", example: "Will you mainly use the shoe for easy road runs and walking?" },
      { name: "Match", example: "The Winflo 12 has soft cushioning and a stable base." },
      { name: "Explain", example: "This helps the shoe feel comfortable and secure during your runs and walks." },
      { name: "Recommend", example: "Based on what you have told me, I recommend trying the Nike Winflo 12. It gives you the everyday comfort and cushioning you are looking for." },
    ],
    experienced: {
      quote: "I already own a fast shoe for workouts. I need a comfortable option for recovery runs and walking between sessions.",
      response: "The Winflo 12 could complement your faster shoe. Its soft cushioning and broad platform suit easy-paced recovery runs and everyday walking. Try it on and compare the fit and feel with your current shoes.",
    },
    needs: [
      { title: "I want a soft shoe for easy runs.", image: "/assets/winflo-air.webp", imageAlt: "Winflo 12 cushioned heel detail", fields: [{ label: "You can say", text: "The soft cushioning helps keep you comfortable during easy runs." }] },
      { title: "I usually land on my heel.", image: "/assets/winflo-air.webp", imageAlt: "Nike Air unit at the heel of the Winflo 12", fields: [{ label: "You can say", text: "The Nike Air unit adds cushioning around the heel to help with impact." }] },
      { title: "My shoes often feel too tight.", image: "/assets/winflo-top.webp", imageAlt: "Top view of the Winflo 12 fit", fields: [{ label: "You can say", text: "The Winflo 12 has a roomy fit that feels comfortable and secure." }] },
      { title: "I want the shoe to feel stable.", image: "/assets/winflo-side.webp", imageAlt: "Broad base of the Winflo 12", fields: [{ label: "You can say", text: "The wider base helps the shoe feel stable underfoot." }] },
      { title: "My feet get warm.", image: "/assets/winflo-upper.webp", imageAlt: "Breathable upper of the Winflo 12", fields: [{ label: "You can say", text: "The breathable upper allows air to move through the shoe." }] },
      { title: "I want a shoe for racing.", image: "/assets/winflo-pair.webp", imageAlt: "Pair of Nike Winflo 12 everyday road-running shoes", fields: [{ label: "You can say", text: "The Winflo 12 is made for comfortable everyday running. Let us look at a lighter performance shoe for racing." }] },
    ],
  },
  practice: {
    intro: "Read each Customer scenario and choose the best answer.",
    questions: [
      { scenario: "A Customer says, “I run regularly and already have a lightweight shoe for speed sessions. I want a comfortable second shoe for recovery runs and long walks.”", prompt: "What is the best response?", options: [
        "Recommend another race shoe so both pairs feel equally fast.",
        "Recommend trying the Nike Winflo 12 as a cushioned option for recovery runs and walking.",
        "Recommend the Winflo 12 for all sessions without discussing how it fits into the Customer’s shoe rotation.",
      ], correct: 1, feedback: "Correct. The Customer already has a speed shoe and is looking for comfort on easier days, which is where the Winflo 12 may fit.", incorrect: "Look at the role this second shoe needs to play: comfort for recovery runs and walks, alongside an existing speed shoe." },
      { scenario: "A Customer says, “I want a light, fast shoe for race day and speed sessions.”", prompt: "What is the best response?", options: [
        "Recommend the Winflo 12 because it is designed mainly for racing.",
        "Explain that the Winflo 12 is for comfortable everyday running, then help the Customer find a lighter performance shoe.",
        "Recommend the Winflo 12 without asking any more questions.",
      ], correct: 1, feedback: "Correct. The Customer’s priority is speed and racing, so a lighter performance shoe is a better match.", incorrect: "This Customer prioritises speed and racing. Explain the Winflo 12’s everyday purpose and guide them toward a lighter performance shoe." },
      { scenario: "A Customer says, “My shoes often feel too tight, and I want something comfortable and secure.”", prompt: "Which Winflo 12 benefit should you explain?", options: [
        "The style code and product weight.", "The race-day performance.",
        "The accommodating fit, which gives the foot more room while still feeling secure.",
      ], correct: 2, feedback: "Correct. The accommodating fit directly responds to the Customer’s concern about tight shoes.", incorrect: "Focus on the Customer’s concern about tight shoes. The accommodating fit is the relevant benefit." },
    ],
  },
  recap: {
    intro: "You have reached the end of the course. You can now identify the right Customer, explain the benefits that matter most and use A-M-E-R to recommend the Nike Winflo 12 with confidence.",
    remember: [
      "It is a men’s road-running shoe designed for comfortable everyday use.",
      "Cushlon 3.0 foam and the Nike Air unit provide soft cushioning.",
      "The roomy fit and breathable upper support comfort.",
      "It is best suited to easy runs, relaxed runs, walking and everyday use.",
      "It is not the first choice when the Customer’s priority is speed or racing.",
      "Use A-M-E-R: Ask, Match, Explain and Recommend.",
    ],
    alternatives: "Ask what they want to keep—cushioning, room, breathability or a steady feel—and what they want to change. Then compare suitable options, encourage them to try the shoes on and recommend the one that best matches their use and fit preference.",
    closingLine: "Based on what you have told me, I recommend trying the Nike Winflo 12 because it gives you the cushioning and everyday comfort you are looking for.",
    closing: "When you understand what the Customer needs, it becomes easier to explain the right benefit and make a helpful recommendation.",
  },
  footer: { text: "Return to People Connect to continue" },
} as const;
