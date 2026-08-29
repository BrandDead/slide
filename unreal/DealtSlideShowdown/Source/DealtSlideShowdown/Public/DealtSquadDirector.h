#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "DealtSquadDirector.generated.h"

UCLASS()
class DEALTSLIDESHOWDOWN_API ADealtSquadDirector : public AActor
{
    GENERATED_BODY()

public:
    ADealtSquadDirector();

protected:
    virtual void Tick(float DeltaSeconds) override;

private:
    float DecisionAccumulator = 0.0f;
    float DecisionInterval = 0.75f;

    void UpdatePresentationAi();
};
