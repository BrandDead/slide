#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "DealtActionGameMode.generated.h"

class ADealtMemberPawn;
class ADealtSquadDirector;

UCLASS()
class DEALTSLIDESHOWDOWN_API ADealtActionGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    ADealtActionGameMode();

protected:
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, Category = "DEALT|Showdown")
    TSubclassOf<ADealtMemberPawn> MemberPawnClass;

    UPROPERTY(EditDefaultsOnly, Category = "DEALT|Showdown")
    TSubclassOf<ADealtSquadDirector> SquadDirectorClass;

private:
    void SpawnCombatant(const struct FDealtCombatant& Combatant);
};
