/**
 * Emoji picker simples — sem dependencia externa.
 *
 * Lista curada de ~60 emojis comuns em Slack, agrupados por categoria.
 * Click insere :emoji_name: (formato Slack) no callback.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

const CATEGORIES = [
  {
    name: "Reações",
    emojis: [
      ["thumbsup", "👍"], ["thumbsdown", "👎"], ["heart", "❤️"], ["fire", "🔥"],
      ["white_check_mark", "✅"], ["x", "❌"], ["warning", "⚠️"], ["100", "💯"],
      ["eyes", "👀"], ["pray", "🙏"], ["clap", "👏"], ["muscle", "💪"],
    ],
  },
  {
    name: "Status",
    emojis: [
      ["rocket", "🚀"], ["bug", "🐛"], ["construction", "🚧"], ["tada", "🎉"],
      ["sparkles", "✨"], ["zap", "⚡"], ["bell", "🔔"], ["mag", "🔍"],
      ["wrench", "🔧"], ["hammer", "🔨"], ["lock", "🔒"], ["unlock", "🔓"],
    ],
  },
  {
    name: "Pessoas",
    emojis: [
      ["smile", "😄"], ["joy", "😂"], ["thinking_face", "🤔"], ["cry", "😢"],
      ["sob", "😭"], ["wink", "😉"], ["sweat_smile", "😅"], ["facepalm", "🤦"],
      ["raised_hands", "🙌"], ["wave", "👋"], ["ok_hand", "👌"], ["point_right", "👉"],
    ],
  },
  {
    name: "Objetos",
    emojis: [
      ["computer", "💻"], ["calendar", "📅"], ["chart_with_upwards_trend", "📈"], ["chart_with_downwards_trend", "📉"],
      ["bar_chart", "📊"], ["bookmark", "🔖"], ["pin", "📌"], ["paperclip", "📎"],
      ["coffee", "☕"], ["pizza", "🍕"], ["bulb", "💡"], ["gear", "⚙️"],
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (slackName: string) => void;
  trigger?: React.ReactNode;
}

const EmojiPicker = ({ onSelect, trigger }: EmojiPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Emoji">
            <Smile size={14} />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" side="top">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-1">
                {cat.name}
              </p>
              <div className="grid grid-cols-6 gap-0.5">
                {cat.emojis.map(([name, char]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelect(name as string)}
                    title={`:${name}:`}
                    className="h-7 w-7 flex items-center justify-center hover:bg-muted rounded text-base transition-colors"
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground border-t pt-1 mt-1 px-1">
          Click insere <span className="font-mono">:nome:</span> (formato Slack)
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
