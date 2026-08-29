#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "DealtEncounterContracts.h"
#include "DealtMemberPawn.generated.h"

class UCameraComponent;
class USpringArmComponent;

UCLASS()
class DEALTSLIDESHOWDOWN_API ADealtMemberPawn : public ACharacter
{
    GENERATED_BODY()

public:
    ADealtMemberPawn();

    UFUNCTION(BlueprintCallable, Category = "DEALT|Member")
    void InitializeFromCombatant(const FDealtCombatant& Combatant);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Member")
    void ApplyCameraMode(EDealtCameraMode CameraMode);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Member")
    void MoveMember(const FVector2D& Input);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Member")
    void LookMember(const FVector2D& Input);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Member")
    FDealtAimedFireCommand FireMemberWeapon(double MaxDistanceMeters = 80.0);

    UFUNCTION(BlueprintPure, Category = "DEALT|Member")
    FString GetMemberId() const { return MemberId; }

    UFUNCTION(BlueprintPure, Category = "DEALT|Member")
    bool IsAvailableForPossession() const { return !bIsDown && CurrentHealth > 0; }

protected:
    virtual void BeginPlay() override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "DEALT|Camera")
    TObjectPtr<USpringArmComponent> ThirdPersonArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "DEALT|Camera")
    TObjectPtr<UCameraComponent> ThirdPersonCamera;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "DEALT|Camera")
    TObjectPtr<UCameraComponent> FirstPersonCamera;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "DEALT|Combat")
    double FireRangeMeters = 80.0;

private:
    UPROPERTY(VisibleInstanceOnly, Category = "DEALT|Member")
    FString MemberId;

    UPROPERTY(VisibleInstanceOnly, Category = "DEALT|Member")
    int32 CurrentHealth = 100;

    UPROPERTY(VisibleInstanceOnly, Category = "DEALT|Member")
    bool bIsDown = false;

    int32 ClientTick = 0;
};
