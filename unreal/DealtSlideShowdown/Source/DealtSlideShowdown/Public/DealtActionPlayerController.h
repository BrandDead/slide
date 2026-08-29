#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "DealtEncounterContracts.h"
#include "DealtActionPlayerController.generated.h"

class ADealtCommanderPawn;
class ADealtMemberPawn;

UCLASS()
class DEALTSLIDESHOWDOWN_API ADealtActionPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    ADealtActionPlayerController();

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;

    UFUNCTION()
    void HandlePossessionChanged(EDealtControlMode ControlMode, const FString& MemberId);

private:
    UPROPERTY()
    TObjectPtr<ADealtCommanderPawn> CommanderPawn;

    float ForwardInput = 0.0f;
    float RightInput = 0.0f;

    void MoveForward(float Value);
    void MoveRight(float Value);
    void Turn(float Value);
    void LookUp(float Value);
    void Fire();
    void CycleCameraMode();
    void NextMember();
    void PreviousMember();
    void ApplyCurrentPossession();
    ADealtMemberPawn* GetControlledMember() const;
};
