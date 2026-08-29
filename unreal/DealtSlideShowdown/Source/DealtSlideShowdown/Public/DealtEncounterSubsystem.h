#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "DealtEncounterContracts.h"
#include "DealtEncounterSubsystem.generated.h"

class ADealtMemberPawn;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDealtEncounterLoadedSignature, const FDealtEncounterPackage&, Encounter);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FDealtPossessionChangedSignature, EDealtControlMode, ControlMode, const FString&, MemberId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDealtAimedFireCommandSignature, const FDealtAimedFireCommand&, Command);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDealtResultReadySignature, const FString&, ResultJson);

UCLASS()
class DEALTSLIDESHOWDOWN_API UDealtEncounterSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable, Category = "DEALT|Encounter")
    FDealtEncounterLoadedSignature OnEncounterLoaded;

    UPROPERTY(BlueprintAssignable, Category = "DEALT|Encounter")
    FDealtPossessionChangedSignature OnPossessionChanged;

    UPROPERTY(BlueprintAssignable, Category = "DEALT|Encounter")
    FDealtAimedFireCommandSignature OnAimedFireCommand;

    UPROPERTY(BlueprintAssignable, Category = "DEALT|Encounter")
    FDealtResultReadySignature OnResultReady;

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    bool LoadCanonicalEncounter(FString& OutError);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    bool LoadEncounterFile(const FString& FilePath, FString& OutError);

    const FDealtEncounterPackage& GetEncounter() const { return Encounter; }

    UFUNCTION(BlueprintPure, Category = "DEALT|Encounter")
    FDealtEncounterPackage GetEncounterCopy() const { return Encounter; }

    UFUNCTION(BlueprintPure, Category = "DEALT|Encounter")
    bool HasEncounter() const { return bEncounterLoaded; }

    UFUNCTION(BlueprintPure, Category = "DEALT|Encounter")
    EDealtCameraMode GetCameraMode() const { return CameraMode; }

    UFUNCTION(BlueprintPure, Category = "DEALT|Encounter")
    EDealtControlMode GetControlMode() const { return ControlMode; }

    UFUNCTION(BlueprintPure, Category = "DEALT|Encounter")
    FString GetSelectedMemberId() const { return SelectedMemberId; }

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    void SetCameraMode(EDealtCameraMode NewMode);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    FString CycleSelectedMember(int32 Direction);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    void RegisterMemberPawn(const FString& MemberId, ADealtMemberPawn* Pawn);

    UFUNCTION(BlueprintPure, Category = "DEALT|Encounter")
    ADealtMemberPawn* FindMemberPawn(const FString& MemberId) const;

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    FDealtAimedFireCommand SubmitNativeHit(
        const FString& ActorId,
        const FVector& TraceOrigin,
        const FVector& TraceDirection,
        double MaxDistanceMeters,
        int32 ClientTick,
        const FHitResult& Hit);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    bool AcceptResultJson(const FString& ResultJson, FString& OutError);

    UFUNCTION(BlueprintCallable, Category = "DEALT|Encounter")
    bool ConsumePendingResultJson(FString& OutResultJson);

private:
    UPROPERTY()
    FDealtEncounterPackage Encounter;

    UPROPERTY()
    EDealtCameraMode CameraMode = EDealtCameraMode::ThirdPerson;

    UPROPERTY()
    EDealtControlMode ControlMode = EDealtControlMode::Possessed;

    UPROPERTY()
    FString SelectedMemberId;

    UPROPERTY()
    TMap<FString, TWeakObjectPtr<ADealtMemberPawn>> MemberPawns;

    UPROPERTY()
    FString PendingResultJson;

    int32 NextSequence = 1;
    bool bEncounterLoaded = false;
    bool bResultConsumed = false;

    TArray<FString> GetLivingCrewIds() const;
};
