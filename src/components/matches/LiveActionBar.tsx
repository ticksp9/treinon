import { Button } from '@/components/ui/button';
import { 
  CircleDot, ArrowLeftRight, CreditCard, 
  HeartPulse, MoreHorizontal, Pause, Play, Square, Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LiveActionBarProps {
  onGoal: () => void;
  onOpponentGoal: () => void;
  onSubstitution: () => void;
  onYellowCard: () => void;
  onRedCard: () => void;
  onInjury?: () => void;
  onObservation?: () => void;
  onEndPart: () => void;
  onPauseResume: () => void;
  onFinishMatch?: () => void;
  isTimerRunning: boolean;
  isLastPart: boolean;
  endPartLabel: string;
  disabled?: boolean;
}

export function LiveActionBar({
  onGoal,
  onOpponentGoal,
  onSubstitution,
  onYellowCard,
  onRedCard,
  onInjury,
  onObservation,
  onEndPart,
  onPauseResume,
  isTimerRunning,
  isLastPart,
  endPartLabel,
  disabled = false,
}: LiveActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto gap-1">
        {/* Goal */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 min-w-[56px]"
          onClick={onGoal}
          disabled={disabled}
        >
          <span className="text-xl">⚽</span>
          <span className="text-[10px] font-medium">Golo</span>
        </Button>

        {/* Substitution */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 min-w-[56px]"
          onClick={onSubstitution}
          disabled={disabled}
        >
          <ArrowLeftRight className="w-5 h-5" />
          <span className="text-[10px] font-medium">Subst.</span>
        </Button>

        {/* Card */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 min-w-[56px]"
          onClick={onYellowCard}
          disabled={disabled}
        >
          <div className="w-4 h-5 bg-yellow-400 rounded-sm border border-yellow-500" />
          <span className="text-[10px] font-medium">Cartão</span>
        </Button>

        {/* Pause/Resume */}
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 min-w-[56px]"
          onClick={onPauseResume}
          disabled={disabled}
        >
          {isTimerRunning ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          <span className="text-[10px] font-medium">
            {isTimerRunning ? 'Pausar' : 'Continuar'}
          </span>
        </Button>

        {/* More */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 min-w-[56px]"
              disabled={disabled}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Mais</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2">
            <DropdownMenuItem onClick={onOpponentGoal}>
              <span className="mr-2">⚽</span>
              Golo do adversário
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRedCard}>
              <div className="w-3 h-4 bg-red-600 rounded-sm mr-2" />
              Cartão vermelho
            </DropdownMenuItem>
            {onInjury && (
              <DropdownMenuItem onClick={onInjury}>
                <HeartPulse className="w-4 h-4 mr-2" />
                Lesão
              </DropdownMenuItem>
            )}
            {onObservation && (
              <DropdownMenuItem onClick={onObservation}>
                <CircleDot className="w-4 h-4 mr-2" />
                Observação
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={onEndPart}
              className={isLastPart ? 'text-destructive focus:text-destructive' : ''}
            >
              {isLastPart ? (
                <Square className="w-4 h-4 mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              {endPartLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
