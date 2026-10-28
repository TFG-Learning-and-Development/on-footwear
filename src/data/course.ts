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
    { id: "lesson-6", label: "Customer scenario" },
    { id: "lesson-7", label: "Practice knowledge check" },
  ],
  hero: {
    title: "Welcome to Nike Winflo 12",
    paragraphs: [
      "The Nike Winflo 12 is a men’s road-running shoe for Customers who want comfort for easy runs and walks. Learn who it suits, how to explain its main benefits and how to recommend it with confidence.",
    ],
  },
  customerMoment: {
    quote: "I am looking for a comfortable shoe for my easy runs and daily walks. I do not need a race shoe. I just want cushioning that feels good.",
  },
  basics: {
    intro: "What does a balanced feel mean to the Customer? As you explore the product basics, think about how you would explain it in everyday language.",
    description: "The Nike Winflo 12 is made for Customers who want comfort during easy runs, walks and everyday activities. It has soft cushioning, a broad platform that helps the foot feel balanced and secure, and a comfortable fit. Customers may describe this need by saying they want a shoe that feels steady, supportive or less wobbly underfoot.",
    phrase: "The Nike Winflo 12 gives you soft cushioning, a balanced feel underfoot and a comfortable fit for your everyday runs and walks.",
  },
  technology: {
    introEmphasis: "From feature to Customer benefit",
    intro: "See what each feature does, how it helps the Customer and how you can explain it simply.",
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
    intro: "Ask how the Customer plans to use the shoe, then use the examples below to check whether it is a good match.",
    examples: [
      { title: "Easy, everyday or relaxed road runs", image: "/assets/winflo-top.webp", imageAlt: "Top view of a pair of Nike Winflo 12 running shoes", fields: [{ label: "Why the Winflo 12 may fit", text: "Soft cushioning helps the Customer feel comfortable on everyday runs." }] },
      { title: "A first running shoe", image: "/assets/winflo-pair.webp", imageAlt: "Pair of Nike Winflo 12 road-running shoes", fields: [{ label: "Why the Winflo 12 may fit", text: "It is a dependable daily trainer with cushioning and support." }] },
      { title: "Walking or all-day comfort", image: "/assets/winflo-upper.webp", imageAlt: "Close view of the Nike Winflo 12 cushioned upper", fields: [{ label: "Why the Winflo 12 may fit", text: "The cushioning supports walking and time spent on your feet." }] },
      { title: "General gym use", image: "/assets/winflo-air.webp", imageAlt: "Nike Winflo 12 sole and heel detail", fields: [{ label: "Why the Winflo 12 may fit", text: "The shoe can support general gym use and light treadmill running." }] },
    ],
    unsuitable: ["Fast intervals or speed sessions", "Tempo runs where the Customer wants a light, quick feel", "Race day performance", "A Customer who prioritises a lightweight, agile shoe"],
    alternative: {
      heading: "If the Customer wants similar features in another shoe",
      guidance: "Ask what they want to keep cushioning, room, breathability or a steady feel and what they want to change. Compare suitable options and encourage them to try the shoes on.",
    },
  },
  updates: {
    intro: "You have seen how the features help the Customer. If they already know the Winflo 11, use these three updates to explain what has changed in the Winflo 12.",
    cards: [
      { title: "Increased Cushlon 3.0 foam stack height", benefit: "More foam underfoot for extra cushioning.", image: "/assets/winflo-side.webp", imageAlt: "Winflo 12 side view showing the Cushlon midsole" },
      { title: "Accommodating fit", benefit: "More room for a comfortable fit.", image: "/assets/winflo-upper.webp", imageAlt: "Winflo 12 upper and lacing detail" },
      { title: "Open-hole mesh upper", benefit: "More airflow through the top of the shoe.", image: "/assets/winflo-air.webp", imageAlt: "Winflo 12 mesh and heel detail" },
    ],
    specifications: [
      { detail: "Product type", specification: "Road-running shoe" }, { detail: "Style code", specification: "HV9272" },
      { detail: "Weight", specification: "Approximately 322 g / 11.37 oz in a men’s US size 10" }, { detail: "Heel-to-toe drop", specification: "10 mm" },
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
      { id: "soft", customer: "I want a soft shoe for easy runs.", benefit: "The soft cushioning helps keep you comfortable during easy runs." },
      { id: "heel", customer: "I usually land on my heel.", benefit: "The Nike Air unit adds cushioning around the heel to help with impact." },
      { id: "fit", customer: "My shoes often feel too tight.", benefit: "The Winflo 12 has a roomy fit that feels comfortable and secure." },
      { id: "stable", customer: "I want the shoe to feel stable.", benefit: "The wider base helps the shoe feel stable underfoot." },
      { id: "warm", customer: "My feet get warm.", benefit: "The breathable upper allows air to move through the shoe." },
      { id: "racing", customer: "I want a shoe for racing.", benefit: "The Winflo 12 is made for comfortable everyday running. Let us look at a lighter performance shoe for racing." },
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
    intro: "Start with the Customer’s needs. Recommend the Nike Winflo 12 for comfortable everyday runs and walks, and suggest a different shoe when speed or race-day performance is the priority. On your next shift, practise an A-M-E-R conversation with a colleague about the Nike Winflo 12, focusing on the benefit that matters most to the Customer.",
  },
  footer: { text: "Return to People Connect to continue" },
} as const;
