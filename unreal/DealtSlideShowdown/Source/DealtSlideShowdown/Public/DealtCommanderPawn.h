#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "DealtCommanderPawn.generated.h"

class UCameraComponent;
class USceneComponent;
class USpringArmComponent;

UCLASS()
class DEALTSLIDESHOWDOWN_API ADealtCommanderPawn : public APawn
{
    GENERATED_BODY()

public:
    ADealtCommanderPawn();

    UFUNCTION(BlueprintCallable, Category = "DEALT|Commander")
    void PanCommander(const FVector2D& Input, float DeltaSeconds);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Commander")
    void ZoomCommander(float Input);

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "DEALT|Commander")
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "DEALT|Commander")
    TObjectPtr<USpringArmComponent> CameraArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "DEALT|Commander")
    TObjectPtr<UCameraComponent> Camera;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "DEALT|Commander")
    float PanSpeed = 1200.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "DEALT|Commander")
    float MinimumArmLength = 650.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "DEALT|Commander")
    float MaximumArmLength = 1800.0f;
};
