/**
 * The 355 questions that make up chapter3five.
 *
 * Authorship principles (read before adding):
 *   1. Specific over generic. "What did your childhood home smell like?" not
 *      "Tell me about your childhood." Specifics surface real memories.
 *   2. Surprising over expected. Skip questions every interview asks.
 *   3. Texture matters. Mix funny / small / deep — never a wall of heavy.
 *   4. Answerable in text. No "demonstrate" or "show me" — this is text-first.
 *   5. Voice-revealing. The answer should sound like THEM, not like a CV.
 *
 * Spanish translations are first-pass and MUST be reviewed by a native
 * speaker before launch. Emotional language varies sharply by region.
 *
 * Goal: 355 total. Currently drafted: 50.
 */

export type Depth = "surface" | "texture" | "depth" | "soul";

export type Category =
  | "self"
  | "childhood"
  | "family"
  | "love"
  | "work"
  | "place"
  | "stories"
  | "advice"
  | "values"
  | "quiet"
  | "legacy";

export type Question = {
  id: number;
  category: Category;
  depth: Depth;
  en: string;
  es: string;
};

export const questions: Question[] = [
  // — Surface (1–15): the onramp. Easy, warm, builds rhythm. —
  {
    id: 1,
    category: "self",
    depth: "surface",
    en: "What's your full name, and what do people who love you actually call you?",
    es: "¿Cuál es tu nombre completo, y cómo te dicen las personas que te quieren?",
  },
  {
    id: 2,
    category: "place",
    depth: "surface",
    en: "Where were you born, and where do you call home now?",
    es: "¿Dónde naciste, y a qué lugar le llamas hogar ahora?",
  },
  {
    id: 3,
    category: "self",
    depth: "surface",
    en: "Are you an early riser or a night owl? When are you most yourself?",
    es: "¿Eres madrugador o nocturno? ¿En qué momento del día te sientes más tú?",
  },
  {
    id: 4,
    category: "self",
    depth: "surface",
    en: "What's the breakfast you'd eat every day if no one judged you?",
    es: "¿Cuál es el desayuno que comerías todos los días si nadie te juzgara?",
  },
  {
    id: 5,
    category: "self",
    depth: "surface",
    en: "How do you actually text — punctuation, capital letters, emojis, lol or haha?",
    es: "¿Cómo escribes mensajes en realidad — con puntuación, mayúsculas, emojis, jeje o jaja?",
  },
  {
    id: 6,
    category: "self",
    depth: "surface",
    en: "What's a song that, no matter where you are, you'll turn up?",
    es: "¿Cuál es una canción que, no importa dónde estés, le subes el volumen?",
  },
  {
    id: 7,
    category: "self",
    depth: "surface",
    en: "What's your laugh like? Describe it for someone who's never heard it.",
    es: "¿Cómo es tu risa? Descríbela para alguien que nunca la ha escuchado.",
  },
  {
    id: 8,
    category: "self",
    depth: "surface",
    en: "What's the most ordinary thing that brings you irrational joy?",
    es: "¿Cuál es la cosa más común que te trae una alegría irracional?",
  },
  {
    id: 9,
    category: "self",
    depth: "surface",
    en: "What do you do when you can't sleep at 3 a.m.?",
    es: "¿Qué haces cuando no puedes dormir a las tres de la mañana?",
  },
  {
    id: 10,
    category: "self",
    depth: "surface",
    en: "Coffee or tea? Sweet or savory? Beach or mountains? Why?",
    es: "¿Café o té? ¿Dulce o salado? ¿Playa o montaña? ¿Por qué?",
  },
  {
    id: 11,
    category: "place",
    depth: "surface",
    en: "What did the street you grew up on look like? What did it sound like at night?",
    es: "¿Cómo era la calle donde creciste? ¿A qué sonaba por la noche?",
  },
  {
    id: 12,
    category: "self",
    depth: "surface",
    en: "Describe the way you dress when no one's watching.",
    es: "Describe cómo te vistes cuando nadie te está viendo.",
  },
  {
    id: 13,
    category: "self",
    depth: "surface",
    en: "What's your handwriting like? Print, cursive, slanted, all caps?",
    es: "¿Cómo es tu letra? ¿Imprenta, cursiva, inclinada, todo en mayúsculas?",
  },
  {
    id: 14,
    category: "self",
    depth: "surface",
    en: "What do you do that surprises people who only know you a little?",
    es: "¿Qué haces que sorprende a las personas que apenas te conocen?",
  },
  {
    id: 15,
    category: "self",
    depth: "surface",
    en: "What's a phrase you say so often, your loved ones could finish your sentence?",
    es: "¿Cuál es una frase que dices tanto, que las personas que te quieren la pueden terminar por ti?",
  },

  // — Texture (16–30): small specifics, surprising details, builds depth without weight. —
  {
    id: 16,
    category: "childhood",
    depth: "texture",
    en: "What did your childhood home smell like? Specifically.",
    es: "¿A qué olía la casa donde creciste? Sé específico.",
  },
  {
    id: 17,
    category: "childhood",
    depth: "texture",
    en: "What was on the walls of your bedroom growing up?",
    es: "¿Qué tenías en las paredes de tu cuarto cuando eras niño?",
  },
  {
    id: 18,
    category: "family",
    depth: "texture",
    en: "What's a meal that was special in your family — who made it, when, why?",
    es: "¿Cuál es una comida que era especial en tu familia — quién la hacía, cuándo, por qué?",
  },
  {
    id: 19,
    category: "stories",
    depth: "texture",
    en: "Who taught you to drive, and how did it actually go?",
    es: "¿Quién te enseñó a manejar, y cómo te fue realmente?",
  },
  {
    id: 20,
    category: "work",
    depth: "texture",
    en: "What was your first job? How much did you make? What did you learn that's stuck?",
    es: "¿Cuál fue tu primer trabajo? ¿Cuánto ganabas? ¿Qué aprendiste que se te quedó?",
  },
  {
    id: 21,
    category: "childhood",
    depth: "texture",
    en: "What's something you believed as a kid that turned out not to be true?",
    es: "¿Qué creías de niño que resultó no ser verdad?",
  },
  {
    id: 22,
    category: "stories",
    depth: "texture",
    en: "Tell me about a scar you have and how you got it.",
    es: "Cuéntame de una cicatriz que tengas y cómo te la hiciste.",
  },
  {
    id: 23,
    category: "self",
    depth: "texture",
    en: "What's a phrase from your parents that you find yourself saying now?",
    es: "¿Cuál es una frase de tus padres que ahora te encuentras diciendo tú?",
  },
  {
    id: 24,
    category: "family",
    depth: "texture",
    en: "Who in your family had the best stories? What's the one you remember most?",
    es: "¿Quién en tu familia contaba las mejores historias? ¿Cuál es la que más recuerdas?",
  },
  {
    id: 25,
    category: "stories",
    depth: "texture",
    en: "What's a time you were caught doing something you weren't supposed to?",
    es: "¿Cuándo te atraparon haciendo algo que no debías estar haciendo?",
  },
  {
    id: 26,
    category: "childhood",
    depth: "texture",
    en: "What were Saturdays like in your house growing up?",
    es: "¿Cómo eran los sábados en tu casa cuando eras niño?",
  },
  {
    id: 27,
    category: "place",
    depth: "texture",
    en: "What's a place that, if you closed your eyes, you could walk through perfectly from memory?",
    es: "¿Cuál es un lugar que, si cerraras los ojos, podrías caminar perfectamente de memoria?",
  },
  {
    id: 28,
    category: "self",
    depth: "texture",
    en: "What do you do better than almost anyone, even if you don't talk about it?",
    es: "¿Qué haces mejor que casi cualquier otra persona, aunque no lo digas?",
  },
  {
    id: 29,
    category: "stories",
    depth: "texture",
    en: "What's a moment that made you laugh so hard you couldn't breathe?",
    es: "¿Cuál es un momento que te hizo reír tanto que no podías respirar?",
  },
  {
    id: 30,
    category: "self",
    depth: "texture",
    en: "What's a small thing you do every day that almost no one knows about?",
    es: "¿Cuál es una cosa pequeña que haces todos los días que casi nadie sabe?",
  },

  // — Depth (31–45): real, can hit harder. Don't show these too early in the flow. —
  {
    id: 31,
    category: "love",
    depth: "depth",
    en: "Who in your life has loved you best, and how could you tell?",
    es: "¿Quién en tu vida te ha querido mejor, y cómo lo sabías?",
  },
  {
    id: 32,
    category: "stories",
    depth: "depth",
    en: "What's a moment you knew, even as it was happening, that you'd remember it forever?",
    es: "¿Cuál es un momento en el que supiste, mientras estaba pasando, que lo recordarías para siempre?",
  },
  {
    id: 33,
    category: "family",
    depth: "depth",
    en: "What did your father teach you — in his words or just the way he lived?",
    es: "¿Qué te enseñó tu padre — con sus palabras o con la forma en que vivió?",
  },
  {
    id: 34,
    category: "family",
    depth: "depth",
    en: "What did your mother teach you — in her words or just the way she lived?",
    es: "¿Qué te enseñó tu madre — con sus palabras o con la forma en que vivió?",
  },
  {
    id: 35,
    category: "love",
    depth: "depth",
    en: "Who taught you something important without ever sitting you down to teach it?",
    es: "¿Quién te enseñó algo importante sin haberse sentado nunca a enseñártelo?",
  },
  {
    id: 36,
    category: "self",
    depth: "depth",
    en: "What were you most afraid of as a child? Are you still afraid of it?",
    es: "¿A qué le tenías más miedo cuando eras niño? ¿Todavía le tienes miedo?",
  },
  {
    id: 37,
    category: "advice",
    depth: "depth",
    en: "What advice would you give your 25-year-old self, and would they have listened?",
    es: "¿Qué consejo le darías a tu yo de 25 años, y te habría hecho caso?",
  },
  {
    id: 38,
    category: "values",
    depth: "depth",
    en: "What's a decision you're most proud you made, even if no one else noticed?",
    es: "¿Cuál es una decisión que te enorgullece haber tomado, aunque nadie más se haya dado cuenta?",
  },
  {
    id: 39,
    category: "stories",
    depth: "depth",
    en: "When have you felt most alive?",
    es: "¿Cuándo te has sentido más vivo?",
  },
  {
    id: 40,
    category: "love",
    depth: "depth",
    en: "Who do you miss, and what do you miss about them most?",
    es: "¿A quién extrañas, y qué es lo que más extrañas de esa persona?",
  },
  {
    id: 41,
    category: "self",
    depth: "depth",
    en: "What's something you've changed your mind about as you've gotten older?",
    es: "¿Sobre qué has cambiado de opinión a medida que has crecido?",
  },
  {
    id: 42,
    category: "values",
    depth: "depth",
    en: "What's something you forgive easily, and something you find hard to forgive?",
    es: "¿Qué perdonas fácilmente, y qué te cuesta perdonar?",
  },
  {
    id: 43,
    category: "love",
    depth: "depth",
    en: "What's the kindest thing anyone has ever done for you?",
    es: "¿Cuál es la cosa más bondadosa que alguien ha hecho por ti?",
  },
  {
    id: 44,
    category: "advice",
    depth: "depth",
    en: "If someone you loved was about to make a big mistake, what would you tell them, and how?",
    es: "Si alguien que amas estuviera por cometer un gran error, ¿qué le dirías, y cómo?",
  },
  {
    id: 45,
    category: "self",
    depth: "depth",
    en: "What do you wish more people understood about you?",
    es: "¿Qué te gustaría que más gente entendiera de ti?",
  },

  // — Soul (46–50): only earned after time in the flow. Quiet, weighty, never sentimental. —
  {
    id: 46,
    category: "quiet",
    depth: "soul",
    en: "What's your most private joy — the one you don't quite talk about?",
    es: "¿Cuál es tu alegría más privada — esa de la que no hablas mucho?",
  },
  {
    id: 47,
    category: "values",
    depth: "soul",
    en: "What do you hope is true about what happens after we die?",
    es: "¿Qué esperas que sea cierto sobre lo que pasa después de morir?",
  },
  {
    id: 48,
    category: "love",
    depth: "soul",
    en: "If you could send one text to someone you've lost, what would it say?",
    es: "Si pudieras mandar un solo mensaje a alguien que perdiste, ¿qué diría?",
  },
  {
    id: 49,
    category: "legacy",
    depth: "soul",
    en: "What do you want to be remembered for — the real answer, not the polished one?",
    es: "¿Por qué quieres ser recordado — la respuesta real, no la pulida?",
  },
  {
    id: 50,
    category: "legacy",
    depth: "soul",
    en: "When the people who love you tell stories about you years from now, what do you hope they say?",
    es: "Cuando las personas que te quieren cuenten historias sobre ti dentro de muchos años, ¿qué esperas que digan?",
  },
];

export const totalQuestions = 355;
export const draftedQuestions = questions.length;
