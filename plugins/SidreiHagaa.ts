import { proto, AnyMessageContent } from "@whiskeysockets/baileys";
import { GetText, Plugin, SendMessage, WAWebsocket } from "../types";
import { containsTrigger } from "../utils";
import { OpenAI } from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

if (!process.env.OPENAI_API_KEY) {
  throw "NO OPENAI API KEY SET. PLEASE SET OPENAI API KEY ENV: OPENAI_API_KEY";
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SidreiHagaaSchema = z.object({
  arr: z
    .array(
      z
        .array(
          z
            .string()
            .describe(
              "The name of the participant. Please if you found it is a mispelled name, use the original name here instead."
            )
        )
        .describe(
          "An array representing one lap. Better placing is earlier in the array (e.g first place is at index 0, second place is index 1, and last place is last)"
        )
    )
    .describe("An array representing all the laps provided"),

  lapsType: z.enum(["sociometic_stretcher", "normal_ordered_arrivals"]),

  mispelledNames: z
    .string()
    .describe(
      "A description of all the mispellings you found, and the original names you assigned to them"
    ),
});

const LAP_TYPE_TO_TITLE: Record<
  z.infer<typeof SidreiHagaaSchema>["lapsType"],
  string
> = {
  sociometic_stretcher: `אלונקה סוציומטרית 🛏️
  
  תפיסה של אלונקה: 2 נקודות
  גריקן: 0.5 נקודות`,

  normal_ordered_arrivals: `סדרי הגעה 🏃‍♂️
  
  ניקוד: מספר הנרשמים במקצה מינוס המרחק שלך מהמקום הראשון`,
};

export class SidreiHagaa extends Plugin {
  constructor(socket: WAWebsocket, getText: GetText, sendMessage: SendMessage) {
    super(socket, getText, sendMessage);
  }

  #triggers = ["@סדרי", "@מקצים"];
  async process(key: proto.IMessageKey, _message: proto.IMessage) {
    if (!key.remoteJid) {
      return;
    }

    if (!containsTrigger(this.getText(key, _message), this.#triggers)) {
      return;
    }

    const message = _message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!message) {
      return;
    }

    const sidreiHagaaRaw = this.getText(key, message);

    console.log("Sidrei HAgga Raw", sidreiHagaaRaw);

    console.log("Gonna get res...");

    const additionalInstructions = removeInstances(
      this.getText(key, _message),
      this.#triggers
    );

    console.log("Additomal instructions", additionalInstructions);

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are a GPT designed to help us count points for laps",
      },
      {
        role: "user",
        content: `הנה רשימה של מקצים
תתרגם לי אותם ל:

2D Array
where each inner array represents one entry
the first place is at index 0, while last place is at last index. ordered.

note that names are always single names and not full names. names are usually seperated by just a space.

i also want you to find any name misspellings and fix them.

since this list was manually written, there may be name misspellings of the same person from one run to another. you should fix the misspelling to the original name. 

please return the string array and the mispellings using the tool provided.

I WILL NOTE THIS AGAIN: IF YOU FOUND A MISPELLING, DONT JUST RETURN IT IN THE MISPELLING FIELD, BUT MAKE SURE U FIX THE MISPELLING IN THE LAPS ARRAY ITSELF AS WELL. THIS IS EXTREMELY IMPORTANT.


as for the lapsType field. you should determine it in the following way:

- normal laps are seperate laps where in each lap, multiple people get written in their order of arrival, and get points in each lap based on their placement.
- sociometric stretcher are the same as the above, but 4 people hit the stretcher, and an optional fifth person picks up a jerrican. The optional fifth person is usually written in parenthesis or seperated with a hyphen, so if some laps have a last person written in parentehsis, its that. The message may also directly specify it as well. Also in sociometic stretcher, if you see פסול or נפסל or something like that in the fifth position, it means the jerrican guy was failed in this laps so just dont enter him.

הרשימה:

${sidreiHagaaRaw}


${additionalInstructions}
`,
      },
    ];

    const _response = (
      await openai.chat.completions.create({
        model:
          "ft:gpt-4o-2024-08-06:personal:adrenalin-arrival-orders-formatter:ACMm8LXy",
        stream: false,
        messages,
        tools: [getFormattedSidreiHagaa],
        tool_choice: getFormattedSidreiHagaa,
      })
    ).choices[0].message;

    const response = _response.tool_calls?.[0].function.arguments;

    console.log("GOT!!", response);

    console.log(
      "Training data:",
      JSON.stringify({
        messages: [...messages, _response],
        tools: [getFormattedSidreiHagaa],
      })
    );
    if (!response) {
      throw "OpenAI didnt respond with toolcall";
    }

    const res = SidreiHagaaSchema.parse(JSON.parse(response));

    const { arr, mispelledNames } = res;

    console.log("Mispelled Nmaes", mispelledNames);

    console.log("Array", arr);
    const points = calculatePoints(res);

    console.log("Points", points);

    const title = LAP_TYPE_TO_TITLE[res.lapsType];

    this.sendMessage(
      key.remoteJid,
      {
        text:
          title +
          "\n\n" +
          points
            .map(
              ([mechona, point], i) =>
                `${i == 0 ? "👑 " : ""}${i + 1}. ${mechona}: ${point}`
            )
            .join("\n"),
      },
      { quoted: { key, message } }
    );
  }
}

const getFormattedSidreiHagaa: ChatCompletionTool = {
  type: "function",
  function: {
    name: "handle_formatted_json_list",
    parameters: zodToJsonSchema(SidreiHagaaSchema),
  },
};

console.log("Tool ser", JSON.stringify(getFormattedSidreiHagaa));

function calculatePoints({
  arr: laps,
  lapsType,
}: z.infer<typeof SidreiHagaaSchema>) {
  const nameToPoints: Record<string, number> = {};

  function calculateArrivalOrderPoints() {
    for (const lap of laps) {
      lap.forEach((mechona, i) => {
        nameToPoints[mechona] ??= 0;

        const points = lap.length - i;

        nameToPoints[mechona] += points;
      });
    }
  }

  function calculateStretcherPoints() {
    const stretcherPoints = 2;
    const jerricanPoints = 0.5;

    for (const lap of laps) {
      const [jerrican, ...stretcher] = lap;
      stretcher.forEach((mechona, i) => {
        nameToPoints[mechona] ??= 0;
        nameToPoints[mechona] += stretcherPoints;
      });
      nameToPoints[jerrican] ??= 0;
      nameToPoints[jerrican] += jerricanPoints;
    }
  }

  switch (lapsType) {
    case "normal_ordered_arrivals":
      calculateArrivalOrderPoints();
      break;
    case "sociometic_stretcher":
      calculateStretcherPoints();
      break;
    default:
      throw "אין תמיכה בסוג זה של סדרי הגעה.";
  }

  return Object.entries(nameToPoints).sort((a, b) => b[1] - a[1]);
}

function removeInstances(inputString: string, removeArray: string[]) {
  // Create a regular expression from the removeArray
  const regex = new RegExp(removeArray.join("|"), "g");

  // Replace all occurrences of the words in removeArray with an empty string
  const resultString = inputString.replace(regex, "");

  // Return the modified string, trimmed of extra spaces
  return resultString.replace(/\s+/g, " ").trim();
}

console.log("TRAINING DATA:");
console.log(
  JSON.stringify({
    messages: [
      {
        role: "system",
        content: "You are a GPT designed to help us count points for laps",
      },
      {
        role: "user",
        content:
          "הנה רשימה של מקצים\nתתרגם לי אותם ל:\n\n2D Array\nwhere each inner array represents one entry\nthe first place is at index 0, while last place is at last index. ordered.\n\nnote that names are always single names and not full names. names are usually seperated by just a space.\n\ni also want you to find any name misspellings and fix them.\n\nsince this list was manually written, there may be name misspellings of the same person from one run to another. you should fix the misspelling to the original name. \n\nplease return the string array and the mispellings using the tool provided.\n\nI WILL NOTE THIS AGAIN: IF YOU FOUND A MISPELLING, DONT JUST RETURN IT IN THE MISPELLING FIELD, BUT MAKE SURE U FIX THE MISPELLING IN THE LAPS ARRAY ITSELF AS WELL. THIS IS EXTREMELY IMPORTANT.\n\n\nas for the lapsType field. you should determine it in the following way:\n\n- normal laps are seperate laps where in each lap, multiple people get written in their order of arrival, and get points in each lap based on their placement.\n- sociometric stretcher are the same as the above, but 4 people hit the stretcher, and an optional fifth person picks up a jerrican. The optional fifth person is usually written in parenthesis, so if some laps have a last person written in parentehsis, its that.\n- numbered laps are basically some sort of lap exersice where instead of writing participants' order of arrival at each lap, each participant counts the numbers of laps they did, and thats their final score at the end of the laps\n\nהרשימה:\n\nספרינטים שכיבות סמיכה אלונקה סוציומטרית\n1. שייבין נהוראי אלקנה כפיר  (מנשירוב)\n2. שייבין כהן איליה נהוראי (מנשירוב)\n3. כפיר ניסים ליאון אמיר (אלקנה) \n4. כהן איליה אלקנה ניסים (נבו)\n5. כפיר שייבין מנשירוב ליאון (אמיר) \n6. שייבין מנשירוב כהן נבסו (אלקנה)\n7. אמיר נבסו איליה כהן (ליאון)\n8. אלקנה נבסו גל מזרחי (שייבין)\n9. כפיר אזרן נבסו ינטי (גולי)\n10. איליה שייבין נבסו כהן (אמיר)\n11. כהן יהודה איליה נבסו (שייבין) \n12. נבסו אמיר ניסים יהודה (מזרחי)\n13. כפיר כהן איליה נבסו \n14. אמיר נבסו כהן גל (נבו)\n15. כהן כפיר ניסים יהודה (אמיר)\n\n\n\n",
      },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_CKuyE2ug0YFR00qrgrmv1QUo",
            type: "function",
            function: {
              name: "handle_formatted_json_list",
              arguments:
                '{"arr":[["נהוראי", "שייבין", "אלקנה", "כפיר", "מנשירוב"], ["כהן", "שייבין", "איליה", "נהוראי", "מנשירוב"], ["כפיר", "ניסים", "ליאון", "אמיר", "אלקנה"], ["כהן", "איליה", "אלקנה", "ניסים", "נבו"], ["כפיר", "שייבין", "מנשירוב", "ליאון", "אמיר"], ["שייבין", "מנשירוב", "כהן", "נבסו", "אלקנה"], ["אמיר", "נבסו", "איליה", "כהן", "ליאון"], ["אלקנה", "נבסו", "גל", "מזרחי", "שייבין"], ["כפיר", "אזרן", "נבסו", "ינטי", "גולי"], ["איליה", "שייבין", "נבסו", "כהן", "אמיר"], ["כהן", "יהודה", "איליה", "נבסו", "שייבין"], ["נבסו", "אמיר", "ניסים", "יהודה", "מזרחי"], ["כפיר", "כהן", "איליה", "נבסו"], ["אמיר", "נבסו", "כהן", "גל", "נבו"], ["כהן", "כפיר", "ניסים", "יהודה", "אמיר"]],"lapsType":"sociometic_stretcher","mispelledNames":"(מנשירוב) -> מנשירוב\\n(אלקנה) -> אלקנה\\n(נבו) -> נבו\\n(אמיר) -> אמיר\\n(שייבין) -> שייבין\\n(גולי) -> גולי\\n(מזרחי) -> מזרחי\\n(נבו) -> נבו\\n(אמיר) -> אמיר"}',
            },
          },
        ],
        refusal: null,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "handle_formatted_json_list",
          parameters: {
            type: "object",
            properties: {
              arr: {
                type: "array",
                items: {
                  type: "array",
                  items: {
                    type: "string",
                    description:
                      "The name of the participant. Please if you found it is a mispelled name, use the original name here instead.",
                  },
                  description:
                    "An array representing one lap. Better placing is earlier in the array (e.g first place is at index 0, second place is index 1, and last place is last)",
                },
                description: "An array representing all the laps provided",
              },
              lapsType: {
                type: "string",
                enum: [
                  "sociometic_stretcher",
                  "normal_ordered_arrivals",
                  "laps_count",
                ],
              },
              mispelledNames: {
                type: "string",
                description:
                  "A description of all the mispellings you found, and the original names you assigned to them",
              },
            },
            required: ["arr", "lapsType", "mispelledNames"],
            additionalProperties: false,
            $schema: "http://json-schema.org/draft-07/schema#",
          },
        },
      },
    ],
  })
);

console.log("------------end----------");
